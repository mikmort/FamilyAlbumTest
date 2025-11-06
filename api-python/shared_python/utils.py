"""
Shared utilities for Python Azure Functions
Provides database connection, storage access, and authentication
"""

import os
import pyodbc
import logging
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta

# Database connection string
def get_db_connection():
    """Create and return a database connection"""
    connection_string = os.environ.get('AZURE_SQL_CONNECTIONSTRING')
    
    if not connection_string:
        raise Exception('AZURE_SQL_CONNECTIONSTRING environment variable not set')
    
    try:
        conn = pyodbc.connect(connection_string)
        return conn
    except Exception as e:
        logging.error(f"Database connection failed: {str(e)}")
        raise

def query_db(sql, params=None):
    """Execute a SELECT query and return results as list of dicts"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        
        columns = [column[0] for column in cursor.description]
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
        
        return results
    except Exception as e:
        logging.error(f"Query failed: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def execute_db(sql, params=None):
    """Execute an INSERT/UPDATE/DELETE query"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        
        conn.commit()
        
        # Return the number of affected rows
        return cursor.rowcount
    except Exception as e:
        if conn:
            conn.rollback()
        logging.error(f"Execute failed: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

def execute_db_with_identity(sql, params=None):
    """Execute an INSERT query and return the identity value"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        
        # Get the identity value
        cursor.execute("SELECT @@IDENTITY AS id")
        identity = cursor.fetchone()[0]
        
        conn.commit()
        return identity
    except Exception as e:
        if conn:
            conn.rollback()
        logging.error(f"Execute with identity failed: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()

# Storage utilities
def get_blob_service_client():
    """Create and return a blob service client"""
    connection_string = os.environ.get('AzureWebJobsStorage')
    
    if not connection_string:
        raise Exception('AzureWebJobsStorage environment variable not set')
    
    return BlobServiceClient.from_connection_string(connection_string)

def download_blob(container_name, blob_name):
    """Download a blob and return its content as bytes"""
    try:
        blob_service_client = get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        
        blob_data = blob_client.download_blob()
        return blob_data.readall()
    except Exception as e:
        logging.error(f"Blob download failed: {str(e)}")
        raise

def blob_exists(container_name, blob_name):
    """Check if a blob exists"""
    try:
        blob_service_client = get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        return blob_client.exists()
    except Exception as e:
        logging.error(f"Blob exists check failed: {str(e)}")
        return False

def upload_blob(container_name, blob_name, data, content_type=None):
    """Upload data to a blob"""
    try:
        blob_service_client = get_blob_service_client()
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        
        blob_client.upload_blob(data, overwrite=True, content_settings={'content_type': content_type} if content_type else None)
        return True
    except Exception as e:
        logging.error(f"Blob upload failed: {str(e)}")
        raise

def generate_blob_url(container_name, blob_name, expiry_hours=1):
    """Generate a SAS URL for a blob"""
    try:
        blob_service_client = get_blob_service_client()
        
        # Extract account name and key from connection string
        connection_string = os.environ.get('AzureWebJobsStorage')
        parts = dict(item.split('=', 1) for item in connection_string.split(';') if '=' in item)
        account_name = parts.get('AccountName')
        account_key = parts.get('AccountKey')
        
        if not account_name or not account_key:
            raise Exception('Could not extract account name and key from connection string')
        
        # Generate SAS token
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
        )
        
        # Construct URL
        url = f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}?{sas_token}"
        return url
    except Exception as e:
        logging.error(f"SAS URL generation failed: {str(e)}")
        raise

# Authentication utilities
def check_authorization(req, required_role='Read'):
    """
    Check if the user is authorized based on Azure Static Web Apps authentication
    Returns: (authorized: bool, user: dict, error: str)
    """
    # Check for dev mode
    dev_mode = os.environ.get('DEV_MODE', '').lower() == 'true'
    
    if dev_mode:
        dev_user = {
            'email': os.environ.get('DEV_USER_EMAIL', 'test@example.com'),
            'role': os.environ.get('DEV_USER_ROLE', 'Full')
        }
        logging.info(f"DEV MODE: Using dev user {dev_user['email']} with role {dev_user['role']}")
        return (True, dev_user, None)
    
    # Get user from Static Web Apps headers
    user_id = req.headers.get('x-ms-client-principal-id')
    user_email = req.headers.get('x-ms-client-principal-name')
    
    if not user_id or not user_email:
        return (False, None, 'Not authenticated')
    
    # Look up user in database
    try:
        users = query_db(
            "SELECT UserID, Email, Role, Status FROM dbo.Users WHERE Email = ?",
            (user_email,)
        )
        
        if not users:
            return (False, None, 'User not found in database')
        
        user = users[0]
        
        if user['Status'] != 'Active':
            return (False, None, f"User status is {user['Status']}")
        
        user_role = user['Role']
        
        # Check role hierarchy: Admin > Full > Read
        role_hierarchy = {'Admin': 3, 'Full': 2, 'Read': 1}
        
        if role_hierarchy.get(user_role, 0) < role_hierarchy.get(required_role, 0):
            return (False, None, f"Insufficient permissions. Required: {required_role}, User has: {user_role}")
        
        return (True, user, None)
    
    except Exception as e:
        logging.error(f"Authorization check failed: {str(e)}")
        return (False, None, f"Authorization error: {str(e)}")

def get_blob_with_sas(filename, expiry_hours=1):
    """
    Get blob URL with SAS token for temporary access
    
    Args:
        filename: Name of the file in blob storage
        expiry_hours: Hours until SAS token expires (default: 1)
        
    Returns:
        str: Full URL with SAS token for Azure Face API to access
    """
    connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    container_name = os.environ.get('BLOB_CONTAINER_NAME', 'family-album-media')
    
    if not connection_string:
        raise Exception('AZURE_STORAGE_CONNECTION_STRING environment variable not set')
    
    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        
        # Generate SAS token for read access
        sas_token = generate_blob_sas(
            account_name=blob_service_client.account_name,
            container_name=container_name,
            blob_name=filename,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
        )
        
        # Construct full URL with SAS token
        blob_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{container_name}/{filename}?{sas_token}"
        
        return blob_url
    except Exception as e:
        logging.error(f"Failed to generate SAS URL for {filename}: {str(e)}")
        raise
