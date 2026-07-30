-- =========================================================
-- DIAGNÓSTICO — só consulta, não altera nada no banco
-- Rode isso inteiro no SQL Editor do Supabase e me manda o resultado
-- =========================================================

-- 1) Existe mais de uma linha "7047" na tabela lotes?
--    (se aparecer mais de 1 linha aqui, achamos o problema)
select id, numero from lotes where numero = '7047';

-- 2) Quantas peças estão vinculadas a CADA id de lote "7047"
--    (se o passo 1 mostrou só 1 linha, aqui também deve mostrar só 1 linha)
select l.id as lote_id, l.numero, count(*) as qtd_pecas
from lote_peca lp
join lotes l on l.id = lp.lote_id
where l.numero = '7047'
group by l.id, l.numero;

-- 3) Quais peças estão de fato vinculadas ao(s) id(s) de lote 7047 agora
select l.id as lote_id, p.codigo
from lote_peca lp
join lotes l on l.id = lp.lote_id
join pecas p on p.id = lp.peca_id
where l.numero = '7047'
order by p.codigo;

-- 4) Existem peças com código duplicado (mesmo texto, ids diferentes)?
select codigo, count(*) as qtd
from pecas
group by codigo
having count(*) > 1;

-- 5) Existem lotes com número duplicado (mesmo texto, ids diferentes)?
select numero, count(*) as qtd
from lotes
group by numero
having count(*) > 1;
