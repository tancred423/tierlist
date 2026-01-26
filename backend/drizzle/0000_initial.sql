CREATE TABLE `placements` (
	`id` varchar(36) NOT NULL,
	`list_id` varchar(36) NOT NULL,
	`card_id` varchar(36) NOT NULL,
	`tier_id` varchar(36),
	`column_id` varchar(36),
	`order_index` int NOT NULL DEFAULT 0,
	CONSTRAINT `placements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`image_url` text,
	`description` text,
	`order_index` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `columns` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`name` varchar(255),
	`order_index` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `columns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `list_co_owners` (
	`list_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `list_co_owners_list_id_user_id_pk` PRIMARY KEY(`list_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `filled_tierlists` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`view_share_token` varchar(64),
	`view_share_enabled` boolean NOT NULL DEFAULT false,
	`edit_share_token` varchar(64),
	`edit_share_enabled` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `filled_tierlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `filled_tierlists_view_share_token_unique` UNIQUE(`view_share_token`),
	CONSTRAINT `filled_tierlists_edit_share_token_unique` UNIQUE(`edit_share_token`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`is_public` boolean NOT NULL DEFAULT false,
	`share_token` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `templates_share_token_unique` UNIQUE(`share_token`)
);
--> statement-breakpoint
CREATE TABLE `tiers` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(7) NOT NULL,
	`order_index` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`discord_id` varchar(255) NOT NULL,
	`username` varchar(255) NOT NULL,
	`discriminator` varchar(10),
	`avatar` varchar(255),
	`email` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_discord_id_unique` UNIQUE(`discord_id`)
);
--> statement-breakpoint
ALTER TABLE `placements` ADD CONSTRAINT `placements_list_id_filled_tierlists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `filled_tierlists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `placements` ADD CONSTRAINT `placements_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `placements` ADD CONSTRAINT `placements_tier_id_tiers_id_fk` FOREIGN KEY (`tier_id`) REFERENCES `tiers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `placements` ADD CONSTRAINT `placements_column_id_columns_id_fk` FOREIGN KEY (`column_id`) REFERENCES `columns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `columns` ADD CONSTRAINT `columns_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `list_co_owners` ADD CONSTRAINT `list_co_owners_list_id_filled_tierlists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `filled_tierlists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `list_co_owners` ADD CONSTRAINT `list_co_owners_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `filled_tierlists` ADD CONSTRAINT `filled_tierlists_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `filled_tierlists` ADD CONSTRAINT `filled_tierlists_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templates` ADD CONSTRAINT `templates_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tiers` ADD CONSTRAINT `tiers_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE cascade ON UPDATE no action;