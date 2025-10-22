import sqlite3

# Open SQLite database
db = sqlite3.connect(r'C:\Family Album\FamilyAlbum.db')
cursor = db.cursor()

# Get the picture
cursor.execute('SELECT PFileName, PPeopleList FROM Pictures WHERE PFileName LIKE ?', ('%DSC04780%',))
pic = cursor.fetchone()

if not pic:
    print('Picture not found')
    exit(1)

print('=== SQLite Database ===')
print('File:', pic[0])
print('PPeopleList:', pic[1])

# Parse IDs
ids = [int(x.strip()) for x in pic[1].split(',') if x.strip()]
print('\nIDs in order:', ids)

# Look up each ID
print('\n=== NameEvent Records (SQLite) ===')
id_to_name = {}
for id in ids:
    cursor.execute('SELECT ID, neName, neType FROM NameEvent WHERE ID = ?', (id,))
    row = cursor.fetchone()
    if row:
        id_to_name[id] = {'name': row[1], 'type': row[2]}
        print(f'{id}: {row[1]} ({row[2]})')
    else:
        print(f'{id}: NOT FOUND')

# Print in order
print('\n=== Mapping: PPeopleList IDs (SQLite) to Names ===')
for idx, id in enumerate(ids):
    if id in id_to_name:
        print(f'{idx + 1}. ID {id} -> {id_to_name[id]["name"]}')
    else:
        print(f'{idx + 1}. ID {id} -> NOT FOUND IN SQLITE')

db.close()
