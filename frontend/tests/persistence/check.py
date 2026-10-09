"""Isolated real-Postgres regression suite. Requires a disposable container only.
Run: python3 tests/persistence/check.py <container-name>
The named container's public schema must be empty. Never point at production.
"""
import concurrent.futures
import copy
import datetime
import json
from pathlib import Path
import subprocess
import sys
import uuid

container = sys.argv[1]
root = Path(__file__).resolve().parents[2]

def sql(statement, ok=True):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        assert result.returncode, 'Expected database rejection'
    return result.stdout.strip()

assert sql("select count(*) from information_schema.tables where table_schema='public'") == '0', 'Requires empty disposable database'
sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
""")
for path in sorted((root / 'drizzle/migrations').glob('*.sql')):
    sql(path.read_text())
print('PASS: all project migrations apply')

account_a, account_b = str(uuid.uuid4()), str(uuid.uuid4())
session_a, session_a2, session_b = [str(uuid.uuid4()) for _ in range(3)]

def payload(name='First thesis', email='a@example.test'):
    return dict(email=email, name='Test User', title=name, belief=name, interpretation='A persistent interpretation', currentValue=1100,
      assets=[dict(asset_id='demo',ticker='DEMO',name='Demo',allocation_percent=100,initial_simulated_price=10,current_simulated_price=11,initial_value=1000,current_value=1100,category='Demo',exposure='Demo exposure',why='Demo reason',risks='Demo risk')],
      snapshots=[dict(date=str(datetime.date(2026,9,1)+datetime.timedelta(days=i)),value=1000+i) for i in range(31)])

def call(user, session, data, ok=True, role='service_role'):
    encoded=json.dumps(data).replace("'", "''")
    return sql(f"SET ROLE {role}; SELECT public.save_tracked_thesis_atomic('{user}','{session}','{encoded}'::jsonb);", ok).splitlines()[-1:][0]

def counts():
    return sql("select (select count(*) from profiles),(select count(*) from theses),(select count(*) from compositions),(select count(*) from composition_assets),(select count(*) from performance_snapshots)")

first=call(account_a,session_a,payload())
assert counts() == '1|1|1|1|31'
print('PASS: first save persists all related rows')
changed_performance=payload(); changed_performance['currentValue']=9999; changed_performance['snapshots'][0]['value']=8888
assert call(account_a,session_a,changed_performance)==first
assert counts() == '1|1|1|1|31'
assert sql('select current_simulated_value from compositions') == '1100.00'
print('PASS: retries preserve IDs, counts and persisted performance')
changed_content=payload('Different idea')
call(account_a,session_a,changed_content,False)
changed_assets=payload();changed_assets['assets'][0]['allocation_percent']=50
call(account_a,session_a,changed_assets,False)
added_asset=payload(); extra=copy.deepcopy(added_asset['assets'][0]); extra['asset_id']='extra'; added_asset['assets'].append(extra)
call(account_a,session_a,added_asset,False)
assert counts() == '1|1|1|1|31'
call(account_b,session_a,payload(email='b@example.test'),False)
print('PASS: reused session cannot silently return another thesis/account')
second=call(account_a,session_a2,payload('Second thesis'))
assert second != first
third=call(account_b,session_b,payload('Other user thesis','b@example.test'))
assert counts() == '2|3|3|3|93'
print('PASS: two theses in account A and an independent thesis in account B')

before=counts(); broken=payload('Failure');broken['snapshots'][-1]['value']=-1
call(str(uuid.uuid4()),str(uuid.uuid4()),broken,False)
assert counts()==before
print('PASS: late insert failure rolls back profile, thesis, composition, assets and snapshots')

concurrent_session=str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    ids=list(pool.map(lambda _:call(account_a,concurrent_session,payload('Concurrent')),range(4)))
assert len(set(ids))==1
assert counts()=='2|4|4|4|124'
print('PASS: four concurrent saves produce one complete thesis')

# Simulate an incomplete record left by the old non-transactional implementation.
legacy_session=str(uuid.uuid4())
legacy=sql(f"insert into theses(user_id,demo_session_id,title,original_belief,interpreted_thesis) values('{account_a}','{legacy_session}','Legacy','Legacy','A persistent interpretation') returning id").splitlines()[0]
assert call(account_a,legacy_session,payload('Legacy')) == legacy
assert counts()=='2|5|5|5|155'
print('PASS: incomplete legacy thesis is repaired instead of returned as success')

for owner, expected in [(account_a,4),(account_b,1)]:
    for table,multiplier in [('theses',1),('compositions',1),('composition_assets',1),('performance_snapshots',31)]:
        result=sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{owner}'; SELECT count(*) FROM public.{table};").splitlines()[-1]
        assert int(result)==expected*multiplier,(owner,table,result)
    hidden=first if owner==account_b else third
    assert sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{owner}'; SELECT count(*) FROM theses WHERE id='{hidden}';").splitlines()[-1]=='0'
print('PASS: two-account RLS isolation on all four tables, including direct detail lookup')
for role in ['anon','authenticated']:
    call(account_a,str(uuid.uuid4()),payload(),False,role)
print('PASS: public/browser roles cannot call privileged save RPC')
assert sql("select count(*) from pg_class where relname in ('theses','compositions','composition_assets','performance_snapshots') and relrowsecurity") == '4'
assert sql("select prosecdef from pg_proc where proname='save_tracked_thesis_atomic'") == 'f'
print('PASS: RLS remains enabled; RPC uses SECURITY INVOKER')
