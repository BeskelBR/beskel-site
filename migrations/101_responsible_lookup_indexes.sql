
CREATE INDEX responsavel_telefone_whatsapp_idx
ON hvb.responsavel (organizacao_id, telefone_whatsapp)
WHERE telefone_whatsapp IS NOT NULL;

CREATE INDEX responsavel_email_idx
ON hvb.responsavel (organizacao_id, email)
WHERE email IS NOT NULL;
