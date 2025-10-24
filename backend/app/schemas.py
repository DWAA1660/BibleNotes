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
    source_book: str
    source_chapter: int
    source_verse: int


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
    verses_text: List[str] = Field(default_factory=list)

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


class CommentaryBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = False


class CommentaryCreate(CommentaryBase):
    pass


class CommentaryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


class CommentaryRead(CommentaryBase):
    id: int
    owner_id: int
    owner_display_name: Optional[str] = None

    class Config:
        orm_mode = True


class CommentaryListResponse(BaseModel):
    commentaries: List[CommentaryRead]


class CommentarySearchResult(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    owner_display_name: Optional[str] = None


class CommentaryEntryBase(BaseModel):
    verse_id: int
    content_markdown: str


class CommentaryEntryCreate(CommentaryEntryBase):
    pass


class CommentaryEntryUpdate(BaseModel):
    content_markdown: Optional[str] = None


class CommentaryEntryRead(CommentaryEntryBase):
    id: int
    commentary_id: int
    content_html: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class CommentaryEntryResponse(BaseModel):
    entries: List[CommentaryEntryRead]


class CommentarySubscriptionRead(BaseModel):
    commentary_id: int
    commentary_title: str
    owner_id: int
    owner_display_name: Optional[str] = None


class UserProfileRead(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str] = None
    avatar_url: str
    note_count: int
    notes: List[NoteRead]


class BacklinksResponse(BaseModel):
    backlinks: List[BacklinkRead]


class AuthorListResponse(BaseModel):
    authors: List[AuthorSummary]


class AuthorSubscriptionListResponse(BaseModel):
    subscriptions: List[AuthorSubscriptionRead]


# User search results
class UserSearchResult(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str] = None


class UserListResponse(BaseModel):
    users: List[UserSearchResult]


class ManuscriptEditionRead(BaseModel):
    code: str
    name: str
    language: str
    scope: str
    license_name: Optional[str] = None
    license_url: Optional[str] = None
    source_url: Optional[str] = None
    description: Optional[str] = None

    class Config:
        orm_mode = True


class ManuscriptVerseRead(BaseModel):
    id: int
    edition_code: str
    book: str
    chapter: int
    verse: int
    canonical_id: str
    text: str

    class Config:
        orm_mode = True


class ManuscriptChapterResponse(BaseModel):
    edition: ManuscriptEditionRead
    book: str
    chapter: int
    verses: List[ManuscriptVerseRead]


class ManuscriptEditionListResponse(BaseModel):
    editions: List[ManuscriptEditionRead]


class ConcordanceHit(BaseModel):
    book: str
    chapter: int
    verse: int
    text: str
    occurrences: int


class ConcordanceResponse(BaseModel):
    query: str
    version_code: str
    total: int
    total_occurrences: int
    hits: List[ConcordanceHit]
