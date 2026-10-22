-- Reference data exported from the shop database.
CREATE TABLE products (
  id INTEGER,
  name TEXT,
  category TEXT,
  vat_rate NUMERIC
);
INSERT INTO products VALUES (1,'Le Petit Prince','book',0.055),(2,'Dune','book',0.2),(3,'Stylo bleu','office',0.2);
