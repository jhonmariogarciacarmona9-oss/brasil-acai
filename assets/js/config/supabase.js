// Create and export the Supabase client to the global window object to avoid CORS
window._supabase = window.supabase.createClient(
    'https://tjdtbjatvlfouaspslju.supabase.co',
    'sb_publishable_eT78mZKt_eaw4mZtJBL_cA_Edpjwlu-'
);
