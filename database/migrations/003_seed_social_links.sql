INSERT INTO profile_social_links(label,url,icon,sort_order)
SELECT COALESCE(item->>'label', CASE WHEN jsonb_typeof(item)='string' THEN item#>>'{}' ELSE item->>'url' END),
       CASE WHEN jsonb_typeof(item)='string' THEN item#>>'{}' ELSE item->>'url' END,
       COALESCE(item->>'icon','link-outline'), ordinality::integer-1
FROM portfolio_profile p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.content->'socialLinks','[]'::jsonb)) WITH ORDINALITY AS links(item,ordinality)
WHERE COALESCE(CASE WHEN jsonb_typeof(item)='string' THEN item#>>'{}' ELSE item->>'url' END,'') <> ''
AND NOT EXISTS (SELECT 1 FROM profile_social_links existing WHERE existing.url=CASE WHEN jsonb_typeof(item)='string' THEN item#>>'{}' ELSE item->>'url' END);
