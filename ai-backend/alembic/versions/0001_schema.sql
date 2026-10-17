CREATE TABLE embedding_profiles (
	name TEXT NOT NULL,
	provider TEXT NOT NULL,
	model TEXT NOT NULL,
	dimensions INTEGER NOT NULL,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CHECK (dimensions = 768),
	UNIQUE (name)
);
CREATE TABLE users (
	firebase_uid TEXT NOT NULL,
	status VARCHAR(20) NOT NULL,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (firebase_uid)
);
CREATE TABLE activity_events (
	event_type VARCHAR(40) NOT NULL,
	activity_code VARCHAR(40),
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
	duration_ms BIGINT,
	points NUMERIC(12, 2),
	value_text TEXT,
	client_event_id TEXT NOT NULL,
	payload JSONB NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, id),
	UNIQUE (user_id, client_event_id),
	CHECK (duration_ms IS NULL OR duration_ms >= 0),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_activity_events_expires_at ON activity_events (expires_at);
CREATE INDEX ix_activity_events_user_id ON activity_events (user_id);
CREATE INDEX ix_events_owner_type_time ON activity_events (user_id, event_type, occurred_at);
CREATE TABLE conversations (
	channel VARCHAR(20) NOT NULL,
	language VARCHAR(8) NOT NULL,
	status VARCHAR(20) NOT NULL,
	ended_at TIMESTAMP WITH TIME ZONE,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_conversations_expires_at ON conversations (expires_at);
CREATE INDEX ix_conversations_owner_time ON conversations (user_id, created_at);
CREATE INDEX ix_conversations_user_id ON conversations (user_id);
CREATE TABLE daily_metrics (
	user_id UUID NOT NULL,
	metric_date DATE NOT NULL,
	scoring_version VARCHAR(30) NOT NULL,
	timezone TEXT NOT NULL,
	game_count INTEGER NOT NULL,
	exercise_count INTEGER NOT NULL,
	activity_points NUMERIC(12, 2) NOT NULL,
	sleep_minutes INTEGER,
	mood VARCHAR(20),
	mood_score INTEGER,
	screen_time_ms BIGINT,
	vani_score INTEGER,
	activity_score INTEGER,
	sleep_score INTEGER,
	screen_score INTEGER,
	composite_score INTEGER,
	computed_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (user_id, metric_date, scoring_version),
	CHECK (sleep_minutes IS NULL OR sleep_minutes BETWEEN 0 AND 1440),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE game_sessions (
	game_code VARCHAR(20) NOT NULL,
	game_version VARCHAR(20) NOT NULL,
	scoring_version VARCHAR(20) NOT NULL,
	difficulty VARCHAR(20) NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
	score NUMERIC(12, 2) NOT NULL,
	round_results JSONB NOT NULL,
	client_session_id TEXT NOT NULL,
	verification_status VARCHAR(30) NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, client_session_id),
	CHECK (ended_at >= started_at AND score >= 0),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_game_sessions_expires_at ON game_sessions (expires_at);
CREATE INDEX ix_game_sessions_user_id ON game_sessions (user_id);
CREATE INDEX ix_game_trends ON game_sessions (user_id, game_code, scoring_version, ended_at);
CREATE TABLE location_points (
	client_event_id TEXT NOT NULL,
	latitude NUMERIC(10, 7) NOT NULL,
	longitude NUMERIC(10, 7) NOT NULL,
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, client_event_id),
	CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_location_points_expires_at ON location_points (expires_at);
CREATE INDEX ix_location_points_user_id ON location_points (user_id);
CREATE TABLE memory_facts (
	fact_key TEXT NOT NULL,
	value_text TEXT NOT NULL,
	user_confirmed BOOLEAN NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, fact_key),
	UNIQUE (user_id, id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_memory_facts_expires_at ON memory_facts (expires_at);
CREATE INDEX ix_memory_facts_user_id ON memory_facts (user_id);
CREATE TABLE profiles (
	user_id UUID NOT NULL,
	display_name TEXT,
	preferred_language VARCHAR(8) NOT NULL,
	timezone TEXT NOT NULL,
	stress_description TEXT,
	sleep_description TEXT,
	wellness_goals TEXT,
	overwhelm_triggers TEXT,
	memory_enabled BOOLEAN NOT NULL,
	transcript_storage_enabled BOOLEAN NOT NULL,
	retention_days INTEGER NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (user_id),
	CHECK (retention_days BETWEEN 1 AND 365),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE screen_time_snapshots (
	client_event_id TEXT NOT NULL,
	metric_date DATE NOT NULL,
	captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
	total_screen_time_ms BIGINT NOT NULL,
	foreground_time_ms BIGINT NOT NULL,
	app_opens INTEGER NOT NULL,
	apps JSONB NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, client_event_id),
	CHECK (total_screen_time_ms >= 0 AND foreground_time_ms >= 0 AND app_opens >= 0),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_screen_time_snapshots_expires_at ON screen_time_snapshots (expires_at);
CREATE INDEX ix_screen_time_snapshots_user_id ON screen_time_snapshots (user_id);
CREATE TABLE visited_places (
	client_event_id TEXT NOT NULL,
	place_name TEXT NOT NULL,
	category VARCHAR(30) NOT NULL,
	latitude NUMERIC(10, 7) NOT NULL,
	longitude NUMERIC(10, 7) NOT NULL,
	entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
	exit_time TIMESTAMP WITH TIME ZONE NOT NULL,
	duration_ms BIGINT NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (user_id, client_event_id),
	CHECK (exit_time >= entry_time AND duration_ms >= 0),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_visited_places_expires_at ON visited_places (expires_at);
CREATE INDEX ix_visited_places_user_id ON visited_places (user_id);
CREATE TABLE background_jobs (
	conversation_id UUID NOT NULL,
	source_revision INTEGER NOT NULL,
	attempts INTEGER NOT NULL,
	status VARCHAR(20) NOT NULL,
	available_at TIMESTAMP WITH TIME ZONE NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id, conversation_id) REFERENCES conversations (user_id, id) ON DELETE CASCADE,
	UNIQUE (conversation_id, source_revision),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_background_jobs_expires_at ON background_jobs (expires_at);
CREATE INDEX ix_background_jobs_user_id ON background_jobs (user_id);
CREATE TABLE live_tickets (
	token_hash VARCHAR(64) NOT NULL,
	conversation_id UUID NOT NULL,
	used BOOLEAN NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id, conversation_id) REFERENCES conversations (user_id, id) ON DELETE CASCADE,
	UNIQUE (token_hash),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_live_tickets_expires_at ON live_tickets (expires_at);
CREATE INDEX ix_live_tickets_user_id ON live_tickets (user_id);
CREATE TABLE messages (
	conversation_id UUID NOT NULL,
	sequence_no BIGINT NOT NULL,
	role VARCHAR(20) NOT NULL,
	content_text TEXT NOT NULL,
	language VARCHAR(8) NOT NULL,
	interrupted BOOLEAN NOT NULL,
	provider_event_id TEXT NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id, conversation_id) REFERENCES conversations (user_id, id) ON DELETE CASCADE,
	UNIQUE (user_id, id),
	UNIQUE (conversation_id, sequence_no),
	UNIQUE (conversation_id, provider_event_id),
	CHECK (role IN ('user','assistant')),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_messages_expires_at ON messages (expires_at);
CREATE INDEX ix_messages_owner_time ON messages (user_id, created_at);
CREATE INDEX ix_messages_user_id ON messages (user_id);
CREATE TABLE rag_documents (
	conversation_id UUID NOT NULL,
	document_type VARCHAR(30) NOT NULL,
	content_text TEXT NOT NULL,
	content_hash VARCHAR(64) NOT NULL,
	source_start_at TIMESTAMP WITH TIME ZONE NOT NULL,
	source_end_at TIMESTAMP WITH TIME ZONE NOT NULL,
	retrieval_enabled BOOLEAN NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id, conversation_id) REFERENCES conversations (user_id, id) ON DELETE CASCADE,
	UNIQUE (user_id, id),
	UNIQUE (conversation_id, content_hash),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_rag_documents_expires_at ON rag_documents (expires_at);
CREATE INDEX ix_rag_documents_user_id ON rag_documents (user_id);
CREATE TABLE rag_chunks (
	document_id UUID NOT NULL,
	chunk_index INTEGER NOT NULL,
	content_text TEXT NOT NULL,
	embedding_profile_id UUID NOT NULL,
	embedding VECTOR(768) NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id, document_id) REFERENCES rag_documents (user_id, id) ON DELETE CASCADE,
	UNIQUE (document_id, chunk_index, embedding_profile_id),
	FOREIGN KEY(embedding_profile_id) REFERENCES embedding_profiles (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_rag_chunks_expires_at ON rag_chunks (expires_at);
CREATE INDEX ix_rag_chunks_user_id ON rag_chunks (user_id);
