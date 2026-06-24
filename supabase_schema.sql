-- ====================================================================
-- SCHEMA DATABASE PER RICARICA CREDITI AI (Supabase / PostgreSQL)
-- ====================================================================

-- 1. Abilitazione dell'estensione UUID (se non già abilitata)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Creazione della tabella 'user_credits'
CREATE TABLE IF NOT EXISTS public.user_credits (
    -- id: UUID legato all'identificativo utente (es. id utente auth.users di Supabase o id esterno)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- email: Indirizzo email del cliente per tracciamento ed invio ricevute Stripe
    email VARCHAR(255) NOT NULL UNIQUE,
    
    -- balance: Saldo monetario residuo in Euro (DECIMAL per massima precisione finanziaria)
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CONSTRAINT balance_non_negative CHECK (balance >= 0.00),
    
    -- created_at: Data di creazione del record
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- updated_at: Data di ultima modifica del record (es. dopo ricarica o consumo AI)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Trigger automatico per aggiornare 'updated_at' ad ogni modifica del record
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON public.user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Sicurezza: Row Level Security (RLS) di Supabase
-- Abilitiamo la RLS per impedire modifiche arbitrarie lato client
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- 5. Creazione delle Policy di Sicurezza RLS
-- Policy per consentire agli utenti autenticati di leggere esclusivamente il proprio saldo
CREATE POLICY "Gli utenti possono leggere il proprio saldo" 
ON public.user_credits 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- NOTA: Gli aggiornamenti del saldo (balance) avvengono SOLO lato server tramite chiave "Service Role" di Supabase,
-- bypassando le policy RLS in modo sicuro nei nostri endpoint API (/api/webhook e /api/chat).
