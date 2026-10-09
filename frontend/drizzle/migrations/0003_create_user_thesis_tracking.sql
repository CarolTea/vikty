CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email text NOT NULL UNIQUE CHECK (char_length(email) <= 254),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  demo_session_id uuid UNIQUE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  original_belief text NOT NULL CHECK (char_length(original_belief) <= 2000),
  interpreted_thesis text NOT NULL CHECK (char_length(interpreted_thesis) <= 4000),
  status text NOT NULL DEFAULT 'demo' CHECK (status = 'demo'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theses TO authenticated;
GRANT ALL ON public.theses TO service_role;
ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own theses" ON public.theses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own theses" ON public.theses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own theses" ON public.theses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own theses" ON public.theses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX theses_user_created_idx ON public.theses(user_id, created_at DESC);

CREATE TABLE public.compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL UNIQUE REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  initial_amount numeric(14,2) NOT NULL CHECK (initial_amount > 0),
  current_simulated_value numeric(14,2) NOT NULL CHECK (current_simulated_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compositions TO authenticated;
GRANT ALL ON public.compositions TO service_role;
ALTER TABLE public.compositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own compositions" ON public.compositions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own compositions" ON public.compositions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own compositions" ON public.compositions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own compositions" ON public.compositions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX compositions_user_idx ON public.compositions(user_id);

CREATE TABLE public.composition_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id uuid NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id text NOT NULL,
  ticker text NOT NULL CHECK (char_length(ticker) <= 20),
  name text NOT NULL CHECK (char_length(name) <= 120),
  allocation_percent numeric(5,2) NOT NULL CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  initial_simulated_price numeric(18,6) NOT NULL CHECK (initial_simulated_price >= 0),
  current_simulated_price numeric(18,6) NOT NULL CHECK (current_simulated_price >= 0),
  initial_value numeric(14,2) NOT NULL CHECK (initial_value >= 0),
  current_value numeric(14,2) NOT NULL CHECK (current_value >= 0),
  category text NOT NULL CHECK (char_length(category) <= 100),
  exposure text NOT NULL CHECK (char_length(exposure) <= 200),
  why text NOT NULL CHECK (char_length(why) <= 300),
  risks text NOT NULL CHECK (char_length(risks) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(composition_id, asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.composition_assets TO authenticated;
GRANT ALL ON public.composition_assets TO service_role;
ALTER TABLE public.composition_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own composition assets" ON public.composition_assets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own composition assets" ON public.composition_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own composition assets" ON public.composition_assets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own composition assets" ON public.composition_assets FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX composition_assets_composition_idx ON public.composition_assets(composition_id);

CREATE TABLE public.performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id uuid NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value numeric(14,2) NOT NULL CHECK (value >= 0),
  snapshot_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(composition_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_snapshots TO authenticated;
GRANT ALL ON public.performance_snapshots TO service_role;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own performance" ON public.performance_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own performance" ON public.performance_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own performance" ON public.performance_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own performance" ON public.performance_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX performance_snapshots_composition_date_idx ON public.performance_snapshots(composition_id, snapshot_date);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER theses_set_updated_at BEFORE UPDATE ON public.theses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER compositions_set_updated_at BEFORE UPDATE ON public.compositions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();