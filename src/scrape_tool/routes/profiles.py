from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List
from src.scrape_tool.configs.database import get_db
from src.scrape_tool.models.db_models import Profile as dbProfile
from src.scrape_tool.models.schemas import Profile as schemaProfile, ProfileUpdate
import re

def slugify(text: str) -> str:
    if not text: return "unnamed"
    text = text.lower()
    text = re.sub(r'[^a-z0-9_]+', '-', text)
    return text.strip('-')

router = APIRouter(tags=["profiles"])

@router.get("/profiles", response_model=List[schemaProfile])
async def get_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(dbProfile))
    profiles = result.scalars().all()
    # Map db objects to schemas (SQLAlchemy Mapped objects)
    return [
        schemaProfile(
            id=p.id,
            slug=getattr(p, 'slug', slugify(p.name)),
            name=p.name,
            siteType=p.site_type,
            toTraditional=p.to_traditional,
            pages=[{**pt, "slug": pt.get("slug") or slugify(pt.get("name", "page"))} for pt in p.page_types]
        ) for p in profiles
    ]

@router.get("/profiles/{profile_id}", response_model=schemaProfile)
async def get_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(dbProfile).where(dbProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return schemaProfile(
        id=profile.id,
        slug=getattr(profile, 'slug', slugify(profile.name)),
        name=profile.name,
        siteType=profile.site_type,
        toTraditional=profile.to_traditional,
        pages=[{**pt, "slug": pt.get("slug") or slugify(pt.get("name", "page"))} for pt in profile.page_types]
    )

@router.post("/profiles", response_model=schemaProfile)
async def create_profile(profile: schemaProfile, db: AsyncSession = Depends(get_db)):
    pages_data = [{**pt.model_dump(by_alias=True), "slug": pt.slug or slugify(pt.name)} for pt in profile.pages]
    
    # Extract the primary page type slug for uniqueness enforcement
    primary_page_type = pages_data[0]["slug"] if pages_data else "default"
    
    db_profile = dbProfile(
        id=profile.id,
        slug=profile.slug or slugify(profile.name),
        name=profile.name,
        site_type=profile.site_type,
        page_type=primary_page_type,
        to_traditional=pages_data[0].get("toTraditional", False) if pages_data else False,
        page_types=pages_data
    )
    db.add(db_profile)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        # Check if it's a unique constraint error
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Profile '{db_profile.slug}' with page type '{primary_page_type}' already exists."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    await db.refresh(db_profile)
    return profile

@router.patch("/profiles/{profile_id}", response_model=schemaProfile)
async def update_profile(profile_id: str, profile_update: ProfileUpdate, db: AsyncSession = Depends(get_db)):
    # Check if profile exists
    result = await db.execute(select(dbProfile).where(dbProfile.id == profile_id))
    db_profile = result.scalar_one_or_none()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    # Prepare update data
    update_data = profile_update.model_dump(exclude_unset=True)
    
    # Internal name mapping
    final_data = {}
    if "name" in update_data: 
        final_data["name"] = update_data["name"]
        if not update_data.get("slug"):
            final_data["slug"] = slugify(update_data["name"])
    if "slug" in update_data: final_data["slug"] = update_data["slug"]
    if "site_type" in update_data: final_data["site_type"] = update_data["site_type"]
    if "pages" in update_data:
        pages_data = [{**pt.model_dump(by_alias=True), "slug": pt.slug or slugify(pt.name)} for pt in profile_update.pages]
        final_data["page_types"] = pages_data
        # Update primary page type if it's explicitly part of the update
        if pages_data:
            final_data["page_type"] = pages_data[0]["slug"]
            final_data["to_traditional"] = pages_data[0].get("toTraditional", False)

    if final_data:
        await db.execute(
            update(dbProfile)
            .where(dbProfile.id == profile_id)
            .values(**final_data)
        )
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            if "UNIQUE constraint failed" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Update failed: This profile and page type combination already exists."
                )
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
            
        await db.refresh(db_profile)
    
    return schemaProfile(
        id=db_profile.id,
        slug=db_profile.slug,
        name=db_profile.name,
        siteType=db_profile.site_type,
        toTraditional=db_profile.to_traditional,
        pages=db_profile.page_types
    )

@router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(dbProfile).where(dbProfile.id == profile_id))
    await db.commit()
    return {"success": True}
