from sqlalchemy import Column, String, JSON, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from src.scrape_tool.configs.database import Base

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    slug: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    site_type: Mapped[str] = mapped_column(String)
    page_type: Mapped[str] = mapped_column(String, index=True)
    to_traditional: Mapped[bool] = mapped_column(default=False)
    # Store page_types as JSON for simplicity and flexibility
    page_types: Mapped[list] = mapped_column(JSON, default=list)

    __table_args__ = (
        UniqueConstraint('slug', 'page_type', name='_profile_page_type_uc'),
    )

    def __repr__(self) -> str:
        return f"Profile(id={self.id!r}, name={self.name!r}, slug={self.slug!r}, page_type={self.page_type!r})"
