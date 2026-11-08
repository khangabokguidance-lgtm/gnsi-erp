delete from public.cbt_attempts;
delete from public.cbt_hits;
delete from public.cbt_tests where id = 'e2e1';
update public.students set parent_phone = '9600000001', dob = date '2011-03-04', gender = 'Female' where gcc_no = '1';
update public.students set parent_phone = '9600000002', dob = null where gcc_no = '2';
insert into public.cbt_tests (id, name, duration_min, sections, status, access_code, marking) values (
  'e2e1', 'E2E Mock Test', 20,
  '[{"id":"s1","label":"A","title":"Maths","questions":[
      {"no":1,"text":"What is 2 + 2?","options":[{"key":"A","text":"3"},{"key":"B","text":"4"},{"key":"C","text":"5"},{"key":"D","text":"6"}]},
      {"no":2,"text":"What is 3 x 3?","options":[{"key":"A","text":"6"},{"key":"B","text":"9"},{"key":"C","text":"12"},{"key":"D","text":"3"}]},
      {"no":3,"text":"What is 10 - 4?","options":[{"key":"A","text":"6"},{"key":"B","text":"5"},{"key":"C","text":"7"},{"key":"D","text":"4"}]}]}]',
  'live', '246810',
  '{"correct":1,"wrong":0,"guests":true,"shuffle":{"questions":true,"options":true}}');
insert into public.cbt_keys (test_id, answers) values ('e2e1', '{"1":"B","2":"B","3":"A"}');
update public.students set parent_phone = '96000000' || (10 + gcc_no::int)::text, dob = date '2011-03-04' where gcc_no::int between 3 and 8;
