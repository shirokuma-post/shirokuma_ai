-- 011: スタイル名を動機型に変更
-- paradigm_break → kizuki, provocative → toi, flip → uragawa,
-- poison_story → yoin, boyaki → honne, yueki → osusowake,
-- jitsuwa → monogatari, kyoukan → yorisoi

-- posts テーブルの style_used を更新
UPDATE posts SET style_used = 'kizuki' WHERE style_used = 'paradigm_break';
UPDATE posts SET style_used = 'toi' WHERE style_used = 'provocative';
UPDATE posts SET style_used = 'uragawa' WHERE style_used = 'flip';
UPDATE posts SET style_used = 'yoin' WHERE style_used = 'poison_story';
UPDATE posts SET style_used = 'honne' WHERE style_used = 'boyaki';
UPDATE posts SET style_used = 'osusowake' WHERE style_used = 'yueki';
UPDATE posts SET style_used = 'monogatari' WHERE style_used = 'jitsuwa';
UPDATE posts SET style_used = 'yorisoi' WHERE style_used = 'kyoukan';

-- schedule_configs の slots JSONB 内の style を更新
UPDATE schedule_configs
SET slots = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'style' = 'paradigm_break' THEN jsonb_set(elem, '{style}', '"kizuki"')
      WHEN elem->>'style' = 'provocative' THEN jsonb_set(elem, '{style}', '"toi"')
      WHEN elem->>'style' = 'flip' THEN jsonb_set(elem, '{style}', '"uragawa"')
      WHEN elem->>'style' = 'poison_story' THEN jsonb_set(elem, '{style}', '"yoin"')
      WHEN elem->>'style' = 'boyaki' THEN jsonb_set(elem, '{style}', '"honne"')
      WHEN elem->>'style' = 'yueki' THEN jsonb_set(elem, '{style}', '"osusowake"')
      WHEN elem->>'style' = 'jitsuwa' THEN jsonb_set(elem, '{style}', '"monogatari"')
      WHEN elem->>'style' = 'kyoukan' THEN jsonb_set(elem, '{style}', '"yorisoi"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(slots) AS elem
)
WHERE slots IS NOT NULL AND slots != '[]'::jsonb;

-- profiles.style_defaults 内の defaultStyle を更新
UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"kizuki"')
WHERE style_defaults->>'defaultStyle' = 'paradigm_break';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"toi"')
WHERE style_defaults->>'defaultStyle' = 'provocative';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"uragawa"')
WHERE style_defaults->>'defaultStyle' = 'flip';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"yoin"')
WHERE style_defaults->>'defaultStyle' = 'poison_story';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"honne"')
WHERE style_defaults->>'defaultStyle' = 'boyaki';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"osusowake"')
WHERE style_defaults->>'defaultStyle' = 'yueki';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"monogatari"')
WHERE style_defaults->>'defaultStyle' = 'jitsuwa';

UPDATE profiles
SET style_defaults = jsonb_set(style_defaults, '{defaultStyle}', '"yorisoi"')
WHERE style_defaults->>'defaultStyle' = 'kyoukan';
