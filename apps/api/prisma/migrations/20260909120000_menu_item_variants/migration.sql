-- CreateTable
CREATE TABLE IF NOT EXISTS "menu_item_variants" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "menu_item_variants_menuItemId_idx" ON "menu_item_variants"("menuItemId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_item_variants_menuItemId_fkey'
  ) THEN
    ALTER TABLE "menu_item_variants"
      ADD CONSTRAINT "menu_item_variants_menuItemId_fkey"
      FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
