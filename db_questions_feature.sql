
create table if not exists task_questions (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  question text not null,
  answer text,
  answered_at timestamptz,
  answered_by uuid references profiles(id),
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

alter table task_questions enable row level security;

create policy "Users can view task questions"
  on task_questions for select
  using ( true );

create policy "Users can insert task questions"
  on task_questions for insert
  with check ( auth.uid() = created_by );

create policy "Users can update task questions"
  on task_questions for update
  using ( true );

create policy "Users can delete task questions"
  on task_questions for delete
  using ( auth.uid() = created_by );
