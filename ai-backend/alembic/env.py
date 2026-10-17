from alembic import context
from sqlalchemy import create_engine, pool
from app.settings import get_settings
from app.db.database import Base
from app.models import domain  # noqa: F401

settings = get_settings()
url = settings.database_migration_url or settings.database_url
if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
