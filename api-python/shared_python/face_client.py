"""
Shared Face API client utility for Azure Cognitive Services Face API
"""
import os
import time
import logging
from azure.cognitiveservices.vision.face import FaceClient
from msrest.authentication import CognitiveServicesCredentials

# Person Group ID for this family album
PERSON_GROUP_ID = 'family-album'

def get_face_client():
    """
    Get configured Face API client
    
    Returns:
        FaceClient: Configured Face API client
    """
    endpoint = os.environ.get('FACE_API_ENDPOINT')
    key = os.environ.get('FACE_API_KEY')
    
    if not endpoint or not key:
        raise ValueError('FACE_API_ENDPOINT and FACE_API_KEY environment variables must be set')
    
    credentials = CognitiveServicesCredentials(key)
    return FaceClient(endpoint, credentials)

def ensure_person_group_exists(face_client, person_group_id=PERSON_GROUP_ID):
    """
    Ensure the PersonGroup exists, create if not
    
    Args:
        face_client: FaceClient instance
        person_group_id: ID of the person group
        
    Returns:
        bool: True if group exists or was created
    """
    try:
        # Check if group exists
        face_client.person_group.get(person_group_id)
        logging.info(f"PersonGroup '{person_group_id}' already exists")
        return True
    except Exception:
        # Group doesn't exist, create it
        try:
            logging.info(f"Creating PersonGroup '{person_group_id}'")
            face_client.person_group.create(
                person_group_id=person_group_id,
                name='Family Album Faces'
                # recognition_model parameter removed - use API default
            )
            logging.info(f"PersonGroup '{person_group_id}' created successfully")
            return True
        except Exception as e:
            logging.error(f"Failed to create PersonGroup: {str(e)}")
            raise Exception(f'Failed to create PersonGroup: {str(e)}')

def wait_for_training(face_client, person_group_id=PERSON_GROUP_ID, timeout=300):
    """
    Wait for PersonGroup training to complete
    
    Args:
        face_client: FaceClient instance
        person_group_id: ID of the person group
        timeout: Maximum seconds to wait
        
    Returns:
        dict: Training status with 'status' and 'message' keys
    """
    start_time = time.time()
    
    while True:
        # Check if timeout exceeded
        if time.time() - start_time > timeout:
            return {
                'status': 'timeout',
                'message': f'Training did not complete within {timeout} seconds'
            }
        
        # Get training status
        training_status = face_client.person_group.get_training_status(person_group_id)
        
        if training_status.status == 'succeeded':
            return {
                'status': 'succeeded',
                'message': 'Training completed successfully'
            }
        elif training_status.status == 'failed':
            return {
                'status': 'failed',
                'message': f'Training failed: {training_status.message}'
            }
        
        # Still training, wait a bit
        time.sleep(2)

def get_or_create_person(face_client, person_id, person_name, person_group_id=PERSON_GROUP_ID):
    """
    Get existing Azure Face Person or create new one
    
    Args:
        face_client: FaceClient instance
        person_id: Database person ID (from NameEvent.ID)
        person_name: Person's name
        person_group_id: ID of the person group
        
    Returns:
        str: Azure Person ID (UUID)
    """
    from .utils import query_db, execute_db
    
    # Check if we already have an Azure Person ID for this person
    result = query_db(
        'SELECT AzurePersonID FROM AzureFacePersons WHERE PersonID = ? AND PersonGroupID = ?',
        (person_id, person_group_id)
    )
    
    if result and len(result) > 0:
        return result[0]['AzurePersonID']
    
    # Create new person in Azure
    try:
        azure_person = face_client.person_group_person.create(
            person_group_id=person_group_id,
            name=person_name
        )
        
        # Store the mapping
        execute_db(
            'INSERT INTO AzureFacePersons (PersonID, AzurePersonID, PersonGroupID) VALUES (?, ?, ?)',
            (person_id, str(azure_person.person_id), person_group_id)
        )
        
        return str(azure_person.person_id)
    except Exception as e:
        raise Exception(f'Failed to create person {person_name}: {str(e)}')

def add_face_from_blob_url(face_client, person_group_id, azure_person_id, image_url):
    """
    Add a face to a person from a blob URL
    
    Args:
        face_client: FaceClient instance
        person_group_id: ID of the person group
        azure_person_id: Azure Person ID (UUID)
        image_url: SAS URL to the image in blob storage
        
    Returns:
        dict: Result with 'success', 'face_id', and optional 'error'
    """
    try:
        result = face_client.person_group_person.add_face_from_url(
            person_group_id=person_group_id,
            person_id=azure_person_id,
            url=image_url,
            detection_model='detection_03'  # Latest model
        )
        
        return {
            'success': True,
            'face_id': str(result.persisted_face_id)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
