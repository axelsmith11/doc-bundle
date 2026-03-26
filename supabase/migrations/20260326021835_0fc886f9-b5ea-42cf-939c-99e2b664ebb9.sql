
-- Table for citas (quotes/appointments)
CREATE TABLE public.citas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  fecha_despacho DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  ocs_count INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for files associated with citas
CREATE TABLE public.cita_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cita_id UUID REFERENCES public.citas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf_oc' or 'excel_export'
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cita_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for citas
CREATE POLICY "Users can view own citas" ON public.citas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own citas" ON public.citas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own citas" ON public.citas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own citas" ON public.citas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for cita_files
CREATE POLICY "Users can view own cita files" ON public.cita_files FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cita files" ON public.cita_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cita files" ON public.cita_files FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for cita files
INSERT INTO storage.buckets (id, name, public) VALUES ('cita-files', 'cita-files', false);

-- Storage RLS policies
CREATE POLICY "Users can upload cita files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cita-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own cita files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cita-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own cita files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cita-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Trigger for updated_at
CREATE TRIGGER update_citas_updated_at BEFORE UPDATE ON public.citas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
