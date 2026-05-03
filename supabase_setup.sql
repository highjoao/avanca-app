-- ===================================================
-- AVANÇA — SUPABASE SETUP
-- Execute este SQL no Supabase SQL Editor
-- (Dashboard > SQL Editor > New query)
-- ===================================================

-- 1. Tabela principal: armazena todos os dados do usuário como JSONB
CREATE TABLE IF NOT EXISTS user_data (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar Row Level Security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 3. Políticas: usuário só acessa seus próprios dados
CREATE POLICY "Users can view own data"
  ON user_data FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (auth.uid() = id);

-- 4. Função: criar dados iniciais quando um novo usuário se registra
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_data (id, data)
  VALUES (
    NEW.id,
    jsonb_build_object(
      'user', jsonb_build_object('name', '', 'onboarded', false),
      'expenses', '[]'::jsonb,
      'incomes', '[]'::jsonb,
      'cards', '[]'::jsonb,
      'receivables', '[]'::jsonb,
      'goals', '[]'::jsonb,
      'tasks', '[]'::jsonb,
      'projects', '[]'::jsonb,
      'categories', '["Alimentação","Transporte","Moradia","Saúde","Educação","Lazer","Compras","Serviços","Assinaturas","Outros"]'::jsonb
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger: executar a função quando um usuário se registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Índice para performance
CREATE INDEX IF NOT EXISTS idx_user_data_updated ON user_data(updated_at);
