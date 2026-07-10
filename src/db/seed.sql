-- UKD Industries - Seed Data
-- Contains default settings and one example wardrobe project for verification.
--
-- HAND-CALC VERIFICATION:
-- Wardrobe: H=7ft, W=5ft, D=1.5ft, 1 partition, 4 shelves/section (2 sections)
--
-- Panels (all in sqft):
--   Side:       2 × (7 × 1.5)          = 21.00
--   Top:        1 × (5 × 1.5)          =  7.50
--   Bottom:     1 × (5 × 1.5)          =  7.50
--   Back:       1 × (7 × 5)            = 35.00
--   Partition:  1 × (7 × 1.5)          = 10.50
--   Shutter:    1 × (7 × 5)            = 35.00
--   Shelves:    8 × (2.5 × 1.5)        = 30.00
--                        section_width = 5/(1+1) = 2.5
--                        4 shelves/section × 2 sections = 8
--   ─────────────────────────────────────────
--   CARCASS AREA TOTAL                  = 146.50 sqft
--
--   Wastage 10%: 146.50 × 1.10         = 161.15 sqft (usable area)
--   Material: 161.15 × ₹85             = ₹13,698 (Matte Laminate)
--   Hardware:  8×₹65 + 4×₹250 + 4×₹120 = ₹2,000
--   Accessories: 1×₹800 + 1×₹450       = ₹1,250
--   Labour: 161.15 × ₹45               = ₹7,252
--   Transport:                          = ₹2,000
--   ─────────────────────────────────────────
--   UNIT SUBTOTAL                       = ₹26,200
--
--   Margin 15%:  26200 × 0.15          = ₹3,930
--   GST 18%: (26200+3930) × 0.18       = ₹5,423
--   ─────────────────────────────────────────
--   GRAND TOTAL                         = ₹35,553

-- ==========================================
-- DEFAULT SETTINGS
-- ==========================================

INSERT OR REPLACE INTO settings (key, value) VALUES
('finish_rates', '{"Matte Laminate": 85, "High Gloss Laminate": 120, "Natural Veneer": 200, "PU Paint": 250, "Acrylic": 180}'),
('hardware_master', '{"Soft-close Hinge": {"unit": "pc", "rate": 65}, "Telescopic Channel": {"unit": "pair", "rate": 250}, "Profile Handle": {"unit": "pc", "rate": 120}, "Drawer Slide": {"unit": "pair", "rate": 180}, "Cabinet Lock": {"unit": "pc", "rate": 45}, "Magnetic Catch": {"unit": "pc", "rate": 15}}'),
('default_wastage_pct', '10'),
('default_margin_pct', '15'),
('gst_pct', '18'),
('labour_rate', '45'),
('quote_prefix', '"UKD"'),
('business_name', '"UKD Industries"'),
('business_tagline', '"Premium Woodwork Solutions"'),
('business_address', '"123 Timber Lane, Suite 400\nBangalore, KA 560001"'),
('business_phone', '"+91 98765 43210"'),
('business_email', '"contact@ukdindustries.com"'),
('terms_and_conditions', '"1. A 50% deposit is required to commence work. Balance is due upon completion of installation.\n2. Quote is valid for 30 days. Material costs may fluctuate beyond this period.\n3. Site must be clear and ready for installation on the agreed date.\n4. Any design changes after approval may incur additional charges.\n5. Warranty: 5 years on carcass, 1 year on hardware."');

-- ==========================================
-- EXAMPLE PROJECT: Master Bedroom Wardrobe
-- ==========================================

INSERT INTO projects (id, client_name, quote_no, date, status, unit_system)
VALUES (1, 'Rajesh Kumar', 'UKD-2026-001', '2026-07-09', 'draft', 'ft');

INSERT INTO units (id, project_id, name, type, finish, wastage_pct, labour_rate, transport)
VALUES (1, 1, 'Master Bedroom Wardrobe', 'wardrobe', 'Matte Laminate', 10, 45, 2000);

-- Panels: H=7ft, W=5ft, D=1.5ft, 1 partition, 4 shelves/section
-- Side panels (2 × 7ft × 1.5ft)
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Side Panel', 7, 1.5, 2);
-- Top panel (1 × 5ft × 1.5ft)
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Top Panel', 5, 1.5, 1);
-- Bottom panel (1 × 5ft × 1.5ft)
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Bottom Panel', 5, 1.5, 1);
-- Back panel (1 × 7ft × 5ft)
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Back Panel', 7, 5, 1);
-- Partition (1 × 7ft × 1.5ft)
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Partition', 7, 1.5, 1);
-- Shutter (1 × 7ft × 5ft)
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Shutter', 7, 5, 1);
-- Shelves: 4 per section × 2 sections = 8 panels, each 2.5ft × 1.5ft
INSERT INTO panels (unit_id, name, length_ft, width_ft, qty) VALUES (1, 'Shelf', 2.5, 1.5, 8);

-- Hardware lines
INSERT INTO hardware_lines (unit_id, item, qty, rate) VALUES (1, 'Soft-close Hinge', 8, 65);
INSERT INTO hardware_lines (unit_id, item, qty, rate) VALUES (1, 'Telescopic Channel', 4, 250);
INSERT INTO hardware_lines (unit_id, item, qty, rate) VALUES (1, 'Profile Handle', 4, 120);

-- Accessory lines
INSERT INTO accessory_lines (unit_id, item, qty, rate) VALUES (1, 'Mirror', 1, 800);
INSERT INTO accessory_lines (unit_id, item, qty, rate) VALUES (1, 'LED Strip Light', 1, 450);
