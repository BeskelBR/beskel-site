SET search_path=hvb,public;
CREATE FUNCTION validar_janela_uso_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE u uso_cobertura;p periodo_diaria;ev evento_cobertura;
BEGIN
 IF NEW.uso_id IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO STRICT ev FROM evento_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evento_id;
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ev.episodio_id FOR UPDATE;
 SELECT * INTO STRICT u FROM uso_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.uso_id;
 SELECT * INTO STRICT p FROM periodo_diaria WHERE organizacao_id=NEW.organizacao_id AND id=NEW.periodo_diaria_id;
 IF u.pacote_episodio_id<>p.pacote_episodio_id OR u.episodio_id<>ev.episodio_id OR p.episodio_id<>ev.episodio_id THEN RAISE EXCEPTION 'Uso e periodo pertencem a associacoes distintas' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER vinculo_janela BEFORE INSERT ON avaliacao_cobertura FOR EACH ROW EXECUTE FUNCTION validar_janela_uso_cobertura();
CREATE TRIGGER vinculo_janela BEFORE INSERT ON reserva_cobertura FOR EACH ROW EXECUTE FUNCTION validar_janela_uso_cobertura();
CREATE FUNCTION serializar_reversao_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 PERFORM ep.id FROM episodio ep JOIN evento_cobertura ev ON ev.organizacao_id=ep.organizacao_id AND ev.episodio_id=ep.id
 JOIN avaliacao_cobertura a ON a.organizacao_id=ev.organizacao_id AND a.evento_id=ev.id WHERE a.organizacao_id=NEW.organizacao_id AND a.id=NEW.avaliacao_id FOR UPDATE OF ep;
 RETURN NEW;
END $$;
CREATE TRIGGER reversao_serializar BEFORE INSERT ON reversao_cobertura FOR EACH ROW EXECUTE FUNCTION serializar_reversao_cobertura();
CREATE FUNCTION validar_decisao_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE av avaliacao_cobertura;ev evento_cobertura;r regra_pacote;rs reserva_cobertura;total numeric;ja boolean;esperado numeric;situacao text;
BEGIN
 SELECT * INTO STRICT av FROM avaliacao_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.avaliacao_id;
 SELECT * INTO STRICT ev FROM evento_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=av.evento_id;
 SELECT rp.* INTO STRICT r FROM regra_pacote rp JOIN uso_cobertura u ON u.organizacao_id=rp.organizacao_id AND u.regra_id=rp.id WHERE u.organizacao_id=NEW.organizacao_id AND u.id=NEW.uso_id;
 SELECT * INTO total,ja FROM compromisso_cobertura(NEW.uso_id,ev.item_clinico_id);
 esperado:=CASE WHEN r.tratamento='excluido' THEN 0 WHEN r.limite_quantidade IS NULL OR (r.dimensao='itens_distintos' AND ja) THEN NEW.quantidade ELSE greatest(0,least(NEW.quantidade,r.limite_quantidade-total)) END;
 situacao:=CASE WHEN r.tratamento='excluido' THEN 'excluido' WHEN esperado=NEW.quantidade THEN 'incluido' WHEN esperado=0 THEN 'excedente' ELSE 'parcial' END;
 IF NEW.incluida<>esperado OR av.resultado<>situacao THEN RAISE EXCEPTION 'Decisao diverge da regra e do limite' USING ERRCODE='23514'; END IF;
 IF av.reserva_id IS NOT NULL THEN SELECT * INTO STRICT rs FROM reserva_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=av.reserva_id;
 IF NEW.incluida<>rs.quantidade OR NEW.excedente<>0 THEN RAISE EXCEPTION 'Efetivacao exige cobertura reservada integral' USING ERRCODE='23514'; END IF;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_validar BEFORE INSERT ON alocacao_cobertura FOR EACH ROW EXECUTE FUNCTION validar_decisao_cobertura();
REVOKE ALL ON FUNCTION validar_janela_uso_cobertura(),serializar_reversao_cobertura(),validar_decisao_cobertura() FROM PUBLIC;
