from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel


class TimestampMixin(SQLModel):
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=False), default=datetime.utcnow),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow),
    )


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    display_name: Optional[str] = None

    notes: list["Note"] = Relationship(back_populates="owner", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    subscriptions: list["UserNoteSubscription"] = Relationship(
        back_populates="subscriber",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "foreign_keys": "[UserNoteSubscription.subscriber_id]",
        },
    )
    followers: list["UserNoteSubscription"] = Relationship(
        back_populates="author",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "foreign_keys": "[UserNoteSubscription.author_id]",
        },
    )
    commentaries: list["Commentary"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    commentary_subscriptions: list["UserCommentarySubscription"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "foreign_keys": "[UserCommentarySubscription.user_id]",
        },
    )


class BibleVersion(SQLModel, table=True):
    code: str = Field(primary_key=True)
    name: str
    language: str
    description: Optional[str] = None

    verses: list["Verse"] = Relationship(
        back_populates="version", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Verse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    version_code: str = Field(foreign_key="bibleversion.code")
    book: str = Field(index=True)
    chapter: int = Field(index=True)
    verse: int = Field(index=True)
    canonical_id: str = Field(index=True)
    text: str

    version: BibleVersion = Relationship(back_populates="verses")
    notes_start: list["Note"] = Relationship(
        back_populates="anchor_start",
        sa_relationship_kwargs={
            "primaryjoin": "Note.start_verse_id == Verse.id",
            "foreign_keys": "Note.start_verse_id",
        },
    )
    notes_end: list["Note"] = Relationship(
        back_populates="anchor_end",
        sa_relationship_kwargs={
            "primaryjoin": "Note.end_verse_id == Verse.id",
            "foreign_keys": "Note.end_verse_id",
        },
    )
    backlink_refs: list["NoteCrossReference"] = Relationship(back_populates="target_verse")


class Note(TimestampMixin, SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")
    title: Optional[str] = None
    content_markdown: str
    content_html: str
    version_code: str = Field(foreign_key="bibleversion.code")
    start_verse_id: int = Field(foreign_key="verse.id")
    end_verse_id: int = Field(foreign_key="verse.id")
    is_public: bool = Field(default=False)

    owner: User = Relationship(back_populates="notes")
    anchor_start: Verse = Relationship(
        back_populates="notes_start", sa_relationship_kwargs={"foreign_keys": "Note.start_verse_id"}
    )
    anchor_end: Verse = Relationship(
        back_populates="notes_end", sa_relationship_kwargs={"foreign_keys": "Note.end_verse_id"}
    )
    cross_references: list["NoteCrossReference"] = Relationship(
        back_populates="note", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class NoteCrossReference(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    note_id: int = Field(foreign_key="note.id")
    canonical_id: str = Field(index=True)
    target_verse_id: int = Field(foreign_key="verse.id")

    note: Note = Relationship(back_populates="cross_references")
    target_verse: Verse = Relationship(back_populates="backlink_refs")


class UserNoteSubscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    subscriber_id: int = Field(foreign_key="user.id")
    author_id: int = Field(foreign_key="user.id")

    subscriber: User = Relationship(
        back_populates="subscriptions",
        sa_relationship_kwargs={"foreign_keys": "[UserNoteSubscription.subscriber_id]"},
    )
    author: User = Relationship(
        back_populates="followers",
        sa_relationship_kwargs={"foreign_keys": "[UserNoteSubscription.author_id]"},
    )


class Commentary(TimestampMixin, SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")
    title: str
    description: Optional[str] = None
    is_public: bool = Field(default=False)

    owner: User = Relationship(back_populates="commentaries")
    entries: list["CommentaryEntry"] = Relationship(
        back_populates="commentary",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    subscriptions: list["UserCommentarySubscription"] = Relationship(
        back_populates="commentary",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class CommentaryEntry(TimestampMixin, SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    commentary_id: int = Field(foreign_key="commentary.id")
    verse_id: int = Field(foreign_key="verse.id")
    content_markdown: str
    content_html: str

    commentary: Commentary = Relationship(back_populates="entries")
    verse: Verse = Relationship()


class UserCommentarySubscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    commentary_id: int = Field(foreign_key="commentary.id")

    user: User = Relationship(
        back_populates="commentary_subscriptions",
        sa_relationship_kwargs={"foreign_keys": "[UserCommentarySubscription.user_id]"},
    )
    commentary: Commentary = Relationship(back_populates="subscriptions")
