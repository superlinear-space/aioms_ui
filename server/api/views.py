"""
API views for the AIOMS backend.
"""
import os
import json
import subprocess
import shutil
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
def health_check(request):
    """Health check endpoint"""
    return Response({
        'status': 'OK',
        'timestamp': datetime.now().isoformat(),
        'service': 'SuperAlarm Config Generator',
        'config': {
            'superalarm_path': settings.SUPERALARM_PATH,
            'superalarm_timeout': settings.SUPERALARM_TIMEOUT,
            'default_cluster_dir': settings.DEFAULT_CLUSTER_DIR,
            'default_output_dir': settings.DEFAULT_OUTPUT_DIR,
            'max_file_size': settings.MAX_FILE_SIZE,
            'debug_mode': settings.DEBUG,
            'log_level': settings.LOG_LEVEL,
            'port': settings.PORT
        }
    })


@api_view(['GET'])
def get_app_settings(request):
    """Get current application settings"""
    return Response({
        'success': True,
        'settings': {
            'superalarm_path': settings.SUPERALARM_PATH,
            'superalarm_timeout': settings.SUPERALARM_TIMEOUT,
            'default_cluster_dir': settings.DEFAULT_CLUSTER_DIR,
            'default_output_dir': settings.DEFAULT_OUTPUT_DIR,
            'max_file_size': settings.MAX_FILE_SIZE,
            'debug_mode': settings.DEBUG,
            'log_level': settings.LOG_LEVEL,
            'port': settings.PORT
        }
    })


@api_view(['POST'])
def update_settings(request):
    """Update application settings (placeholder)"""
    # This endpoint was not implemented in Flask, keeping as placeholder
    return Response({'message': 'Settings update not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)


@api_view(['POST'])
def generate_prom_rules(request):
    """Generate Prometheus rules using superalarm generate-configs command"""
    try:
        data = request.data
        
        if not data:
            return Response({'error': 'No JSON data provided'}, status=status.HTTP_400_BAD_REQUEST)
            
        cluster_dir = data.get('cluster_dir', settings.DEFAULT_CLUSTER_DIR)
        output_dir = data.get('output_dir', settings.DEFAULT_OUTPUT_DIR)
        
        logger.info(f"Request data: {data}")
        logger.info(f"Using cluster_dir: {cluster_dir}")
        logger.info(f"Using output_dir: {output_dir}")
        
        # Validate paths
        cluster_path = Path(cluster_dir)
        output_path = Path(output_dir)
        
        logger.info(f"Cluster path exists: {cluster_path.exists()}")
        logger.info(f"Cluster path absolute: {cluster_path.absolute()}")
        
        if not cluster_path.exists():
            return Response({
                'error': f'Cluster directory does not exist: {cluster_dir}',
                'absolute_path': str(cluster_path.absolute()),
                'current_working_dir': os.getcwd()
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create output directory if it doesn't exist
        output_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Output directory created: {output_path.absolute()}")
                
        # Check if superalarm command is available
        superalarm_cmd = settings.SUPERALARM_PATH if os.path.isabs(settings.SUPERALARM_PATH) else shutil.which(settings.SUPERALARM_PATH)
        logger.info(f"Superalarm command: {superalarm_cmd}")
        logger.info(f"Superalarm path from config: {settings.SUPERALARM_PATH}")
        
        if not superalarm_cmd:
            return Response({
                'error': f'superalarm command not found at {settings.SUPERALARM_PATH}. Please check SUPERALARM_PATH in config.json.',
                'searched_path': settings.SUPERALARM_PATH,
                'is_absolute': os.path.isabs(settings.SUPERALARM_PATH)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Execute superalarm generate-configs command
        try:
            cmd = [
                superalarm_cmd,
                'generate-configs',
                '--cluster-model', str(cluster_path),
                '--output', str(output_path)
            ]
            
            logger.info(f"Executing command: {' '.join(cmd)}")
            
            # Run the command
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.SUPERALARM_TIMEOUT,
                cwd=os.getcwd()
            )
            
            logger.info(f"Command return code: {result.returncode}")
            logger.info(f"Command stdout: {result.stdout}")
            logger.info(f"Command stderr: {result.stderr}")
            
            if result.returncode != 0:
                logger.error(f"superalarm command failed with return code {result.returncode}")
                logger.error(f"stderr: {result.stderr}")
                return Response({
                    'error': 'superalarm command failed',
                    'details': result.stderr,
                    'return_code': result.returncode,
                    'command': ' '.join(cmd)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Count generated files
            generated_files = list(output_path.rglob('*'))
            file_count = len([f for f in generated_files if f.is_file()])
            
            # Look for specific Prometheus rule files
            prometheus_files = list(output_path.rglob('*prometheus*'))
            prometheus_files.extend(list(output_path.rglob('*rules*')))
            prometheus_files.extend(list(output_path.rglob('*.yml')))
            prometheus_files.extend(list(output_path.rglob('*.yaml')))
            
            # Remove duplicates
            prometheus_files = list(set(prometheus_files))
            
            logger.info(f"superalarm command completed successfully. Generated {file_count} files")
            logger.info(f"Command output: {result.stdout}")
            
            return Response({
                'success': True,
                'message': 'Prometheus rules generated successfully using superalarm',
                'output_dir': str(output_path),
                'cluster_dir': str(cluster_path),
                'files_generated': file_count,
                'prometheus_files': [str(f) for f in prometheus_files],
                'command_output': result.stdout,
                'command': ' '.join(cmd),
                'rules_count': file_count  # For backward compatibility
            })
            
        except subprocess.TimeoutExpired:
            logger.error(f"superalarm command timed out after {settings.SUPERALARM_TIMEOUT} seconds")
            return Response({
                'error': f'superalarm command timed out ({settings.SUPERALARM_TIMEOUT} seconds)',
                'details': 'The command took too long to complete'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as cmd_error:
            logger.error(f"Error executing superalarm command: {cmd_error}")
            return Response({
                'error': 'Failed to execute superalarm command',
                'details': str(cmd_error),
                'command': ' '.join(cmd) if 'cmd' in locals() else 'Unknown'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        logger.error(f"Error generating Prometheus rules: {e}")
        return Response({
            'error': 'Internal server error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def check_superalarm(request):
    """Check if superalarm command is available and get version info"""
    try:
        superalarm_cmd = settings.SUPERALARM_PATH if os.path.isabs(settings.SUPERALARM_PATH) else shutil.which(settings.SUPERALARM_PATH)
        
        if not superalarm_cmd:
            return Response({
                'available': False,
                'error': f'superalarm command not found at {settings.SUPERALARM_PATH}',
                'configured_path': settings.SUPERALARM_PATH
            })
        
        # Try to get version info
        try:
            result = subprocess.run(
                [superalarm_cmd, '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            version_info = result.stdout.strip() if result.returncode == 0 else 'Unknown'
            
            return Response({
                'available': True,
                'version': version_info,
                'path': superalarm_cmd,
                'configured_path': settings.SUPERALARM_PATH
            })
        except:
            return Response({
                'available': True,
                'version': 'Unknown',
                'path': superalarm_cmd,
                'configured_path': settings.SUPERALARM_PATH
            })
            
    except Exception as e:
        return Response({
            'available': False,
            'error': str(e),
            'configured_path': settings.SUPERALARM_PATH
        })
