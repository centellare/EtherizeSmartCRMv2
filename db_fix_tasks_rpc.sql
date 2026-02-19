CREATE OR REPLACE FUNCTION public.create_task_safe(
    p_object_id uuid,
    p_title text,
    p_assigned_to uuid,
    p_start_date date,
    p_deadline date,
    p_comment text,
    p_doc_link text,
    p_doc_name text,
    p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
    v_task_id uuid;
    v_stage text;
BEGIN
    -- Определяем текущий этап объекта
    SELECT current_stage INTO v_stage FROM public.objects WHERE id = p_object_id;

    INSERT INTO public.tasks (
        object_id, title, assigned_to, start_date, deadline, 
        comment, doc_link, doc_name, created_by, stage_id, status
    ) VALUES (
        p_object_id, p_title, p_assigned_to, p_start_date, p_deadline,
        p_comment, p_doc_link, p_doc_name, p_user_id, v_stage, 'pending'
    ) RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
