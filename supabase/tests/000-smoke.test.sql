begin;

select plan(1);

select is(1, 1, 'pgTAP is available for database tests');

select * from finish();

rollback;
