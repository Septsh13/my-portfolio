UPDATE portfolio_profile SET content = content || jsonb_build_object(
  'emailDisplay','septsh@gmail.com',
  'phoneLink','+12133522795',
  'birthdayDate','1982-06-23',
  'imageAlt','Om Kharche'
) WHERE id=1 AND NOT (content ? 'emailDisplay');
UPDATE contact_settings SET displayed_email='septsh@gmail.com' WHERE id=1 AND displayed_email='septshkumar@gmail.com';
