-- Manual (non-Docker) Postgres setup. Run as a superuser, e.g. `psql -U postgres -f setup.sql`.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cme') THEN
        CREATE USER cme WITH PASSWORD 'cme_dev_password';
    END IF;
END
$$;
-- Owned by cme so it can create tables in the public schema (Postgres 15+ restricts this by default).
CREATE DATABASE cme_registration OWNER cme;
