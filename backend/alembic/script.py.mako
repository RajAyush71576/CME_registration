"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
<<<<<<< HEAD
"""
=======

"""
from typing import Sequence, Union

>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

<<<<<<< HEAD
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
=======
# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, Sequence[str], None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Upgrade schema."""
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
<<<<<<< HEAD
=======
    """Downgrade schema."""
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
    ${downgrades if downgrades else "pass"}
