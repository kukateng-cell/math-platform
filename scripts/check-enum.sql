SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name IN ('ChildProfile', 'Skill') AND column_name IN ('gradeLevel', 'promotionTarget');
