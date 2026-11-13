-- Handlers who resolve complaints
CREATE TABLE public.handlers (
  id text PRIMARY KEY,
  name text NOT NULL,
  zone text NOT NULL,
  available boolean NOT NULL DEFAULT true,
  capacity integer NOT NULL DEFAULT 3 CHECK (capacity >= 0 AND capacity <= 50),
  is_escalation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.handlers TO service_role;
ALTER TABLE public.handlers ENABLE ROW LEVEL SECURITY;

-- Explicit routing table: (zone, category) -> primary + backup handler
CREATE TABLE public.routing_table (
  id serial PRIMARY KEY,
  zone text NOT NULL,
  category text NOT NULL,
  primary_handler text NOT NULL REFERENCES public.handlers(id),
  backup_handler text NOT NULL REFERENCES public.handlers(id),
  UNIQUE (zone, category)
);
GRANT ALL ON public.routing_table TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.routing_table_id_seq TO service_role;
ALTER TABLE public.routing_table ENABLE ROW LEVEL SECURITY;

-- Complaint reports
CREATE TABLE public.reports (
  id text PRIMARY KEY,
  reporter_name text NOT NULL,
  reporter_email text NOT NULL,
  reporter_phone text NOT NULL,
  restaurant_id text NOT NULL,
  order_id text NOT NULL,
  zone_code text NOT NULL,
  zone text NOT NULL,
  complaint_code text NOT NULL,
  description text NOT NULL,
  urgency text NOT NULL,
  category text NOT NULL,
  category_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  classification_conflict boolean NOT NULL DEFAULT false,
  priority integer NOT NULL,
  priority_override text,
  status text NOT NULL,
  handler_id text REFERENCES public.handlers(id),
  assignment_type text NOT NULL,
  routing_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_status_idx ON public.reports(status);
CREATE INDEX reports_handler_idx ON public.reports(handler_id);
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Status history
CREATE TABLE public.report_events (
  id bigserial PRIMARY KEY,
  report_id text NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_events_report_idx ON public.report_events(report_id);
GRANT ALL ON public.report_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.report_events_id_seq TO service_role;
ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;

-- Seed handlers
INSERT INTO public.handlers (id, name, zone, available, capacity, is_escalation) VALUES
 ('H-N1','Arjun Mehta','NORTH',true,3,false),
 ('H-N2','Priya Nair','NORTH',true,2,false),
 ('H-S1','Karthik Rao','SOUTH',true,3,false),
 ('H-S2','Divya Iyer','SOUTH',true,2,false),
 ('H-E1','Rahul Das','EAST',true,3,false),
 ('H-E2','Sneha Bose','EAST',false,2,false),
 ('H-W1','Vikram Patil','WEST',true,3,false),
 ('H-W2','Ananya Joshi','WEST',true,2,false),
 ('H-C1','Rohan Kapoor','CENTRAL',true,3,false),
 ('H-C2','Meera Singh','CENTRAL',true,2,false),
 ('H-ESC','Neha Sharma (Escalation Desk)','ALL',true,10,true);

-- Seed routing table: Food Quality & Hygiene -> handler 1 primary; Service, Billing, Delivery -> handler 2 primary
INSERT INTO public.routing_table (zone, category, primary_handler, backup_handler)
SELECT z.zone, c.category,
  CASE WHEN c.category IN ('Food Quality','Hygiene') THEN z.h1 ELSE z.h2 END,
  CASE WHEN c.category IN ('Food Quality','Hygiene') THEN z.h2 ELSE z.h1 END
FROM (VALUES ('NORTH','H-N1','H-N2'),('SOUTH','H-S1','H-S2'),('EAST','H-E1','H-E2'),('WEST','H-W1','H-W2'),('CENTRAL','H-C1','H-C2')) AS z(zone,h1,h2)
CROSS JOIN (VALUES ('Food Quality'),('Service'),('Hygiene'),('Billing'),('Delivery')) AS c(category);

-- Seed demo reports
INSERT INTO public.reports (id, reporter_name, reporter_email, reporter_phone, restaurant_id, order_id, zone_code, zone, complaint_code, description, urgency, category, category_scores, classification_conflict, priority, priority_override, status, handler_id, assignment_type, routing_note, created_at, updated_at) VALUES
 ('RCT-261108-A1K9','Aisha Khan','aisha.khan@mail.com','9876543210','RST-1021','ORD-554201','NZ-01','NORTH','FQ101','The biryani was cold and the chicken was undercooked.','medium','Food Quality','{"Food Quality":5,"Service":0,"Hygiene":0,"Billing":0,"Delivery":0}',false,3,null,'resolved','H-N1','primary','Routed NORTH/Food Quality to primary H-N1', now() - interval '5 days', now() - interval '4 days'),
 ('RCT-261109-B7Q2','Ravi Kumar','ravi.k@mail.com','9123456780','RST-2044','ORD-882310','SZ-03','SOUTH','BL201','I was overcharged on the bill and the discount was not applied.','high','Billing','{"Food Quality":0,"Service":0,"Hygiene":0,"Billing":5,"Delivery":0}',false,2,null,'in_progress','H-S2','primary','Routed SOUTH/Billing to primary H-S2', now() - interval '4 days', now() - interval '3 days'),
 ('RCT-261110-C3M8','Fatima Shaikh','fatima.s@mail.com','9988776655','RST-3310','ORD-120045','EZ-02','EAST','HY301','Found a cockroach in the curry, the kitchen looked dirty.','high','Hygiene','{"Food Quality":0,"Service":0,"Hygiene":5,"Billing":0,"Delivery":0}',false,2,null,'assigned','H-E1','primary','Routed EAST/Hygiene to primary H-E1', now() - interval '3 days', now() - interval '3 days'),
 ('RCT-261110-D5T1','John Mathew','john.m@mail.com','9012345678','RST-4102','ORD-773201','WZ-05','WEST','DL401','Delivery was 90 minutes late and the rider was rude.','medium','Delivery','{"Food Quality":0,"Service":1,"Hygiene":0,"Billing":0,"Delivery":5}',false,3,null,'resolved','H-W2','primary','Routed WEST/Delivery to primary H-W2', now() - interval '3 days', now() - interval '2 days'),
 ('RCT-261111-E9P4','Sana Ali','sana.ali@mail.com','9345678901','RST-5007','ORD-660182','CZ-01','CENTRAL','SV501','Staff ignored us for 40 minutes, very slow service.','low','Service','{"Food Quality":0,"Service":5,"Hygiene":0,"Billing":0,"Delivery":0}',false,4,null,'assigned','H-C2','primary','Routed CENTRAL/Service to primary H-C2', now() - interval '2 days', now() - interval '2 days'),
 ('RCT-261111-F2R6','Kabir Singh','kabir.s@mail.com','9456789012','RST-1188','ORD-345678','NZ-02','NORTH','HY302','After eating here my son got food poisoning and was vomiting.','medium','Hygiene','{"Food Quality":0,"Service":0,"Hygiene":7,"Billing":0,"Delivery":0}',false,1,'Health-risk override: medium → P1 Critical','escalated','H-ESC','escalation','Critical override sent to escalation desk', now() - interval '2 days', now() - interval '2 days'),
 ('RCT-261112-G4W3','Lena D''Souza','lena.d@mail.com','9567890123','RST-7001','ORD-909090','QZ-07','UNKNOWN','FQ102','Burnt pizza and stale bread.','medium','Food Quality','{"Food Quality":5,"Service":0,"Hygiene":0,"Billing":0,"Delivery":0}',false,3,null,'escalated','H-ESC','escalation','Unknown routing zone QZ — escalated', now() - interval '1 day', now() - interval '1 day'),
 ('RCT-261112-H8Z5','Imran Qureshi','imran.q@mail.com','9678901234','RST-3399','ORD-404040','EZ-04','EAST','DL402','Wrong order delivered and packaging was spilled.','low','Delivery','{"Food Quality":0,"Service":0,"Hygiene":0,"Billing":0,"Delivery":6}',false,4,null,'assigned','H-E1','backup','Primary H-E2 unavailable — fallback to backup H-E1', now() - interval '20 hours', now() - interval '20 hours'),
 ('RCT-261113-J1N7','Pooja Reddy','pooja.r@mail.com','9789012345','RST-2290','ORD-515151','SZ-01','SOUTH','FQ103','Food was too salty and tasteless, portion was tiny.','low','Food Quality','{"Food Quality":7,"Service":0,"Hygiene":0,"Billing":0,"Delivery":0}',false,4,null,'resolved','H-S1','primary','Routed SOUTH/Food Quality to primary H-S1', now() - interval '10 hours', now() - interval '4 hours');

INSERT INTO public.report_events (report_id, from_status, to_status, note, created_at)
SELECT id, null, CASE WHEN status IN ('resolved','in_progress') THEN CASE WHEN assignment_type='escalation' THEN 'escalated' ELSE 'assigned' END ELSE status END, routing_note, created_at FROM public.reports;
INSERT INTO public.report_events (report_id, from_status, to_status, note, created_at)
SELECT id, 'assigned', 'in_progress', 'Handler started work', updated_at - interval '1 hour' FROM public.reports WHERE status IN ('in_progress','resolved');
INSERT INTO public.report_events (report_id, from_status, to_status, note, created_at)
SELECT id, 'in_progress', 'resolved', 'Resolved by handler', updated_at FROM public.reports WHERE status = 'resolved';