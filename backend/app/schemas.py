from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int


class UserBase(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int

    class Config:
        orm_mode = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class BibleVersionRead(BaseModel):
    code: str
    name: str
    language: str
    description: Optional[str] = None

    class Config:
        orm_mode = True


class VerseRead(BaseModel):
    id: int
    version_code: str
    book: str
    chapter: int
    verse: int
    canonical_id: str
    text: str

    class Config:
        orm_mode = True


class BacklinkRead(BaseModel):
    note_id: int
    note_title: Optional[str] = None
    note_owner_name: Optional[str] = None
    note_owner_id: int
    note_is_public: bool


class VerseWithBacklinks(VerseRead):
    backlinks: List[BacklinkRead] = Field(default_factory=list)


class NoteBase(BaseModel):
    title: Optional[str] = None
    content_markdown: str
    version_code: str
    start_verse_id: int
    end_verse_id: int
    is_public: bool = False


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content_markdown: Optional[str] = None
    is_public: Optional[bool] = None
    end_verse_id: Optional[int] = None


class NoteRead(NoteBase):
    id: int
    content_html: str
    owner_id: int
    owner_display_name: Optional[str] = None
    start_book: str
    start_chapter: int
    start_verse: int
    end_book: str
    end_chapter: int
    end_verse: int
    created_at: datetime
    updated_at: datetime
    cross_references: List[str] = Field(default_factory=list)

    class Config:
        orm_mode = True


class AuthorSummary(BaseModel):
    author_id: int
    author_display_name: Optional[str] = None
    public_note_count: int


class AuthorSubscriptionRead(BaseModel):
    author_id: int
    author_display_name: Optional[str] = None


class AuthorNotesRead(BaseModel):
    author_id: int
    author_display_name: Optional[str] = None
    notes: List["NoteRead"]


class AuthorNotesSummary(BaseModel):
    author_id: int
    author_display_name: Optional[str] = None
    note_count: int


class AuthorNotesResponse(BaseModel):
    authors: List[AuthorNotesRead]


class BibleChapterResponse(BaseModel):
    version: BibleVersionRead
    book: str
    chapter: int
    verses: List[VerseWithBacklinks]


class NotesResponse(BaseModel):
    notes: List[NoteRead]


class BacklinksResponse(BaseModel):
    backlinks: List[BacklinkRead]


class AuthorListResponse(BaseModel):
    authors: List[AuthorSummary]


class AuthorSubscriptionListResponse(BaseModel):
    subscriptions: List[AuthorSubscriptionRead]
