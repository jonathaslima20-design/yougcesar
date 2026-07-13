-- Add associated_color column to product_images to allow mapping images to product colors
ALTER TABLE product_images ADD COLUMN associated_color text DEFAULT NULL;

-- Index for efficient lookup of images by product and color
CREATE INDEX idx_product_images_associated_color ON product_images(product_id, associated_color)
  WHERE associated_color IS NOT NULL;