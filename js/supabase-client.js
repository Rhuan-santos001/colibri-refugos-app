// =========================================================
// CONFIGURAÇÃO DO SUPABASE
// Troque os dois valores abaixo pelos dados do SEU projeto:
// Supabase > Project Settings > API
// =========================================================
const SUPABASE_URL = "https://mfskwgzfvobqnomvowon.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mc2t3Z3pmdm9icW5vbXZvd29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTg3MjAsImV4cCI6MjEwMDQ5NDcyMH0.hRgurhWtshSBE3ClJpDe5HltUwQI0Z2YzDc_W-Zutk4";

// Nome do bucket de storage usado para as fotos de aprovação
const STORAGE_BUCKET = "fotos-refugo";

// Cria o client (biblioteca carregada via CDN no <head> de cada página)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
