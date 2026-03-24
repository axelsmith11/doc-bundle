
-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Processes table
CREATE TABLE public.processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processes" ON public.processes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own processes" ON public.processes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own processes" ON public.processes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own processes" ON public.processes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Process files table
CREATE TABLE public.process_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('comprobante_pdf', 'sunat_zip', 'guia_remision', 'orden_compra', 'partes_ingreso')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.process_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.process_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own files" ON public.process_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.process_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.process_files FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for process files
INSERT INTO storage.buckets (id, name, public) VALUES ('process-files', 'process-files', false);

CREATE POLICY "Users can view own process files" ON storage.objects FOR SELECT
  USING (bucket_id = 'process-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own process files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'process-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own process files" ON storage.objects FOR UPDATE
  USING (bucket_id = 'process-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own process files" ON storage.objects FOR DELETE
  USING (bucket_id = 'process-files' AND auth.uid()::text = (storage.foldername(name))[1]);
