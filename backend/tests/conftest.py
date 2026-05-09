from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, create_engine

from app.api.deps import get_db
from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="session", autouse=True)
def setup_test_db() -> None:
    with Session(engine) as session:
        init_db(session)


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    # Connect to the database
    connection = engine.connect()
    
    # Begin a non-ORM transaction
    transaction = connection.begin()
    
    # Bind a new session to the connection
    session = Session(bind=connection)
    
    # Start a nested transaction (savepoint)
    # This allows the app to call session.commit() which will only "commit" the savepoint
    nested = connection.begin_nested()

    # If the app code calls session.commit(), it will close the savepoint.
    # We need to restart it to keep the isolation until the end of the test.
    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(session, transaction):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session

    session.close()
    # Roll back the outermost transaction, which rolls back everything including savepoints
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="function")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
