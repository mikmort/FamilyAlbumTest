import sqlite3

# Open SQLite database
db = sqlite3.connect(r'C:\Family Album\FamilyAlbum.db')
cursor = db.cursor()

# Get ALL NameEvent records from SQLite
cursor.execute('SELECT ID, neName, neType FROM NameEvent ORDER BY ID')
sqlite_people = cursor.fetchall()

print('=== All NameEvent from SQLite ===')
print('Total records:', len(sqlite_people))
print('\nFirst 20 records (for building mapping):')
for id, name, type in sqlite_people[:20]:
    print(f'SQLite ID {id}: {name} ({type})')

# Now get the specific IDs from DSC04780
cursor.execute('SELECT PFileName, PPeopleList FROM Pictures WHERE PFileName LIKE ?', ('%DSC04780%',))
pic = cursor.fetchone()

if pic:
    print('\n\n=== DSC04780 Analysis ===')
    print('PPeopleList (SQLite IDs):', pic[1])
    ids = [int(x.strip()) for x in pic[1].split(',') if x.strip()]
    
    print('\nMapping these SQLite IDs to names:')
    for idx, id in enumerate(ids):
        cursor.execute('SELECT neName, neType FROM NameEvent WHERE ID = ?', (id,))
        row = cursor.fetchone()
        if row:
            print(f'{idx + 1}. SQLite ID {id} -> {row[0]} ({row[1]})')
        else:
            print(f'{idx + 1}. SQLite ID {id} -> NOT FOUND IN SQLITE')

# Export a mapping CSV for all people
print('\n\nExporting mapping...')
with open(r'C:\Users\jb_mo\OneDrive\Documents\FamilyAlbumTest\scripts\sqlite_people_mapping.csv', 'w') as f:
    f.write('sqlite_id,name,type\n')
    for id, name, type in sqlite_people:
        f.write(f'{id},{name.replace(",", ";")},,{type}\n')

print('Mapping exported to sqlite_people_mapping.csv')

db.close()
