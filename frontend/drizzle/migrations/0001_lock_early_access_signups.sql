CREATE POLICY "No public reads of early access signups"
ON public.early_access_signups
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "No direct public inserts of early access signups"
ON public.early_access_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "No public updates of early access signups"
ON public.early_access_signups
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No public deletes of early access signups"
ON public.early_access_signups
FOR DELETE
TO anon, authenticated
USING (false);