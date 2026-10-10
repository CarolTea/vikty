ALTER TABLE public.theses ADD CONSTRAINT theses_id_user_unique UNIQUE (id, user_id);
ALTER TABLE public.compositions ADD CONSTRAINT compositions_id_user_unique UNIQUE (id, user_id);
ALTER TABLE public.compositions ADD CONSTRAINT compositions_thesis_owner_fkey FOREIGN KEY (thesis_id, user_id) REFERENCES public.theses(id, user_id) ON DELETE CASCADE;
ALTER TABLE public.composition_assets ADD CONSTRAINT composition_assets_owner_fkey FOREIGN KEY (composition_id, user_id) REFERENCES public.compositions(id, user_id) ON DELETE CASCADE;
ALTER TABLE public.performance_snapshots ADD CONSTRAINT performance_snapshots_owner_fkey FOREIGN KEY (composition_id, user_id) REFERENCES public.compositions(id, user_id) ON DELETE CASCADE;