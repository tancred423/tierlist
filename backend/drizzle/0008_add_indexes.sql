CREATE INDEX idx_templates_owner_id ON templates(owner_id);
--> statement-breakpoint
CREATE INDEX idx_templates_is_public ON templates(is_public);
--> statement-breakpoint
CREATE INDEX idx_filled_tierlists_owner_id ON filled_tierlists(owner_id);
--> statement-breakpoint
CREATE INDEX idx_filled_tierlists_template_id ON filled_tierlists(template_id);
--> statement-breakpoint
CREATE INDEX idx_template_likes_template_id ON template_likes(template_id);
--> statement-breakpoint
CREATE INDEX idx_template_likes_user_id ON template_likes(user_id);
--> statement-breakpoint
CREATE INDEX idx_placements_list_id ON placements(list_id);
--> statement-breakpoint
CREATE INDEX idx_tiers_template_id ON tiers(template_id);
--> statement-breakpoint
CREATE INDEX idx_columns_template_id ON columns(template_id);
--> statement-breakpoint
CREATE INDEX idx_cards_template_id ON cards(template_id);
--> statement-breakpoint
CREATE INDEX idx_list_co_owners_user_id ON list_co_owners(user_id);
