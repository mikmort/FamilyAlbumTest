-- Mark additional family members by last name
-- Moss, Kaplan, Hodges, and Kaplan-Moss family members

UPDATE dbo.NameEvent
SET IsFamilyMember = 1
WHERE neType = 'N'
AND (
    neName LIKE '% Moss'
    OR neName LIKE 'Moss %'
    OR neName = 'Moss'
    OR neName LIKE '% Kaplan'
    OR neName LIKE 'Kaplan %'
    OR neName = 'Kaplan'
    OR neName LIKE '% Hodges'
    OR neName LIKE 'Hodges %'
    OR neName = 'Hodges'
    OR neName LIKE '% Kaplan-Moss'
    OR neName LIKE 'Kaplan-Moss %'
    OR neName = 'Kaplan-Moss'
);

-- Show results
SELECT 
    (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') as TotalPeople,
    (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N' AND IsFamilyMember = 1) as FamilyMembers,
    (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N' AND (IsFamilyMember = 0 OR IsFamilyMember IS NULL)) as NonFamilyMembers;
