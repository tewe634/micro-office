UPDATE sales_collab_template_rule
SET participant_role = 'COLLABORATOR',
    duty_label = NULL,
    updated_at = NOW()
WHERE participant_role IS DISTINCT FROM 'COLLABORATOR'
   OR duty_label IS NOT NULL;

UPDATE sales_collab_org_rule
SET participant_role = 'COLLABORATOR',
    duty_label = NULL,
    updated_at = NOW()
WHERE participant_role IS DISTINCT FROM 'COLLABORATOR'
   OR duty_label IS NOT NULL;
