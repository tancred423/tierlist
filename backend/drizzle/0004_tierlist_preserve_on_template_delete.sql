ALTER TABLE `filled_tierlists` DROP FOREIGN KEY `filled_tierlists_template_id_templates_id_fk`;
--> statement-breakpoint
ALTER TABLE `filled_tierlists` MODIFY COLUMN `template_id` varchar(36);
--> statement-breakpoint
ALTER TABLE `filled_tierlists` ADD CONSTRAINT `filled_tierlists_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE `placements` DROP FOREIGN KEY `placements_card_id_cards_id_fk`;
--> statement-breakpoint
ALTER TABLE `placements` DROP FOREIGN KEY `placements_tier_id_tiers_id_fk`;
--> statement-breakpoint
ALTER TABLE `placements` DROP FOREIGN KEY `placements_column_id_columns_id_fk`;
