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
    created_at: datetime
    updated_at: datetime
    cross_references: List[str] = Field(default_factory=list)

    class Config:
        orm_mode = True


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


class CommentarySubscriptionRead(BaseModel):
    commentary_id: int
    commentary_title: str
    owner_id: int
    owner_display_name: Optional[str] = None


class CommentarySearchResult(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    owner_display_name: Optional[str] = None


class BibleChapterResponse(BaseModel):
    version: BibleVersionRead
    book: str
    chapter: int
    verses: List[VerseWithBacklinks]


class NotesResponse(BaseModel):
    notes: List[NoteRead]


class BacklinksResponse(BaseModel):
    backlinks: List[BacklinkRead]


class CommentaryListResponse(BaseModel):
    commentaries: List[CommentaryRead]


class CommentaryEntryResponse(BaseModel):
    entries: List[CommentaryEntryRead]
