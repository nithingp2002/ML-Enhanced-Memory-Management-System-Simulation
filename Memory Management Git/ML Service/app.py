"""
Flask ML Microservice for Memory Management System
Provides ML-based page replacement prediction with sklearn-style ML pipeline

Models:
- Random Forest (sklearn RandomForestClassifier)
- XGBoost (XGBClassifier)
- Naive Bayes (sklearn MultinomialNB)
"""
import torch # CRITICAL: Must be imported before sklearn/xgboost to avoid DLL conflicts
from flask import Flask, jsonify, request
from flask_cors import CORS
from predictors.lstm_model import LSTMPredictor # PyTorch
from predictors.random_forest import RandomForestPredictor
from predictors.xgboost_model import XGBoostPredictor
import json
import gc  # Garbage collection to prevent memory buildup

app = Flask(__name__)
CORS(app)

# Initialize predictors
predictors = {
    'random_forest': RandomForestPredictor(frame_count=4),
    'xgboost': XGBoostPredictor(frame_count=4),
    'lstm': LSTMPredictor(frame_count=4)
}

# ============ CUMULATIVE TRAINING STATE ============
# Stores accumulated training data until workload type changes or manual reset
training_state = {
    'accumulated_sequences': [],  # All sequences from same workload type
    'current_workload_type': None,  # Track current workload type
    'total_samples': 0,  # Total training samples accumulated
    'training_history': []  # History of training sessions
}


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ML Memory Predictor',
        'models': list(predictors.keys())
    })


@app.route('/train', methods=['POST'])
def train_model():
    """
    Train ML model using sklearn-style pipeline
    
    Request body:
    {
        "model": "random_forest" | "xgboost" | "naive_bayes",
        "sequences": [[1,2,3,4,5], [2,3,4,5,1], ...]
    }
    
    Pipeline Steps:
    1. Data Loading
    2. Preprocessing
    3. Train/Test Split
    4. Feature Scaling (if applicable)
    5. Model Building
    6. Training
    7. Evaluation
    """
    try:
        data = request.json
        model_name = data.get('model', 'random_forest')
        sequences = data.get('sequences', [])
        
        if model_name not in predictors:
            return jsonify({'error': f'Unknown model: {model_name}'}), 400
        
        if not sequences:
            return jsonify({'error': 'No training sequences provided'}), 400
        
        predictor = predictors[model_name]
        
        # Run the sklearn-style ML pipeline
        metrics = predictor.run_pipeline(sequences)
        
        return jsonify({
            'status': 'success',
            'model': model_name,
            'pipeline': [
                'Data Loading',
                'Feature Engineering',
                'Preprocessing',
                'Train/Test Split',
                'Model Building',
                'Training',
                'Evaluation'
            ],
            'metrics': metrics,
            'model_stats': predictor.get_model_stats() if hasattr(predictor, 'get_model_stats') else {}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/train-all', methods=['POST'])
def train_all_models():
    """
    Train ALL ML models using sklearn-style pipeline with CUMULATIVE data
    
    Request body:
    {
        "sequences": [[1,2,3,4,5], [2,3,4,5,1], ...],
        "workloadType": "locality" | "random" | "sequential" | "loop" | "working-set",
        "resetAccumulated": false  // Optional: force reset accumulated data
    }
    
    Cumulative Training:
    - Accumulates training data from same workload type
    - Auto-resets when workload type changes
    - Manual reset via resetAccumulated flag or /reset endpoint
    """
    global training_state
    try:
        data = request.json
        sequences = data.get('sequences', [])
        workload_type = data.get('workloadType', 'unknown')
        reset_accumulated = data.get('resetAccumulated', False)
        
        if not sequences:
            return jsonify({'error': 'No training sequences provided'}), 400
        
        # Check if workload type changed - auto reset if so
        type_changed = False
        if training_state['current_workload_type'] is not None and \
           training_state['current_workload_type'] != workload_type:
            print(f"[CUMULATIVE] Workload type changed: {training_state['current_workload_type']} -> {workload_type}")
            print(f"[CUMULATIVE] Auto-resetting accumulated data")
            training_state['accumulated_sequences'] = []
            training_state['total_samples'] = 0
            type_changed = True
        
        # Manual reset if requested
        if reset_accumulated:
            print(f"[CUMULATIVE] Manual reset requested")
            training_state['accumulated_sequences'] = []
            training_state['total_samples'] = 0
        
        # Update current workload type
        training_state['current_workload_type'] = workload_type
        
        # Add new sequences to accumulated data
        training_state['accumulated_sequences'].extend(sequences)
        training_state['total_samples'] += len(sequences[0]) if sequences else 0
        
        # Limit accumulated data to prevent memory issues (max 10 sequences)
        MAX_ACCUMULATED = 10
        if len(training_state['accumulated_sequences']) > MAX_ACCUMULATED:
            training_state['accumulated_sequences'] = training_state['accumulated_sequences'][-MAX_ACCUMULATED:]
            print(f"[CUMULATIVE] Trimmed to last {MAX_ACCUMULATED} sequences")
        
        # Train on ALL accumulated sequences
        all_sequences = training_state['accumulated_sequences']
        print(f"[CUMULATIVE] Training on {len(all_sequences)} accumulated sequences")
        
        results = {}
        
        for model_name, predictor in predictors.items():
            try:
                metrics = predictor.run_pipeline(all_sequences)
                
                results[model_name] = {
                    'status': 'success',
                    'metrics': metrics,
                    'model_stats': predictor.get_model_stats() if hasattr(predictor, 'get_model_stats') else {}
                }
            except Exception as e:
                results[model_name] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        # Record training session
        training_state['training_history'].append({
            'workload_type': workload_type,
            'sequences_count': len(all_sequences),
            'type_changed': type_changed
        })
        
        return jsonify({
            'status': 'success',
            'results': results,
            'cumulative_info': {
                'workload_type': workload_type,
                'accumulated_sequences': len(all_sequences),
                'type_changed': type_changed,
                'auto_reset': type_changed
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict', methods=['POST'])
def predict():
    """Get prediction from specified model"""
    try:
        data = request.json
        model_name = data.get('model', 'random_forest')
        
        if model_name not in predictors:
            return jsonify({'error': f'Unknown model: {model_name}'}), 400
        
        predictor = predictors[model_name]
        
        return jsonify({
            'model': model_name,
            'stats': predictor.get_model_stats() if hasattr(predictor, 'get_model_stats') else {}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/access', methods=['POST'])
def access_page():
    """Process page access for specified model"""
    try:
        data = request.json
        model_name = data.get('model', 'random_forest')
        process_id = data.get('processId', 'P1')
        page_number = data.get('pageNumber', 0)
        
        if model_name not in predictors:
            return jsonify({'error': f'Unknown model: {model_name}'}), 400
        
        predictor = predictors[model_name]
        result = predictor.access_page(process_id, page_number)
        
        return jsonify({
            'model': model_name,
            'result': result,
            'stats': predictor.get_model_stats() if hasattr(predictor, 'get_model_stats') else {}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/access-all', methods=['POST'])
def access_page_all():
    """Process page access for ALL models simultaneously"""
    try:
        data = request.json
        process_id = data.get('processId', 'P1')
        page_number = data.get('pageNumber', 0)
        
        results = {}
        for model_name, predictor in predictors.items():
            result = predictor.access_page(process_id, page_number)
            stats = predictor.get_model_stats() if hasattr(predictor, 'get_model_stats') else {}
            results[model_name] = {
                'result': result,
                'stats': stats
            }
        
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/stats', methods=['GET'])
def get_stats():
    """Get statistics for all models including training status and cumulative info"""
    try:
        stats = {}
        for name, predictor in predictors.items():
            # Get basic state
            if hasattr(predictor, 'get_state'):
                state = predictor.get_state()
            elif hasattr(predictor, 'get_stats'):
                state = predictor.get_stats()
            else:
                state = {}
            
            # Add model stats including training status
            if hasattr(predictor, 'get_model_stats'):
                model_stats = predictor.get_model_stats()
                state['trained'] = model_stats.get('is_fitted', False)
                state['accuracy'] = model_stats.get('train_accuracy', 0)
                state['test_accuracy'] = model_stats.get('test_accuracy', 0)
                state['n_classes'] = model_stats.get('n_classes', 0)
            else:
                state['trained'] = False
            
            stats[name] = state
        
        # Add cumulative training info
        stats['_cumulative'] = {
            'workload_type': training_state['current_workload_type'],
            'accumulated_sequences': len(training_state['accumulated_sequences']),
            'total_samples': training_state['total_samples']
        }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/stats/<model_name>', methods=['GET'])
def get_model_stats(model_name):
    """Get statistics for specific model"""
    try:
        if model_name not in predictors:
            return jsonify({'error': f'Unknown model: {model_name}'}), 400
        
        predictor = predictors[model_name]
        
        stats = {}
        if hasattr(predictor, 'get_state'):
            stats = predictor.get_state()
        elif hasattr(predictor, 'get_stats'):
            stats = predictor.get_stats()
        
        if hasattr(predictor, 'get_model_stats'):
            stats['model_details'] = predictor.get_model_stats()
        
        return jsonify({
            'model': model_name,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/reset', methods=['POST'])
def reset_all():
    """Reset all predictors AND accumulated training data"""
    global predictors, training_state
    try:
        data = request.json or {}
        frame_count = data.get('frameCount', 4)
        
        predictors = {
            'random_forest': RandomForestPredictor(frame_count=frame_count),
            'xgboost': XGBoostPredictor(frame_count=frame_count),
            'lstm': LSTMPredictor(frame_count=frame_count)
        }
        
        # Reset cumulative training state
        training_state = {
            'accumulated_sequences': [],
            'current_workload_type': None,
            'total_samples': 0,
            'training_history': []
        }
        print("[CUMULATIVE] Reset - cleared all accumulated training data")
        
        # Force garbage collection
        gc.collect()
        
        return jsonify({
            'status': 'success',
            'message': 'All models and accumulated data reset',
            'frameCount': frame_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/reset/<model_name>', methods=['POST'])
def reset_model(model_name):
    """Reset specific predictor"""
    try:
        if model_name not in predictors:
            return jsonify({'error': f'Unknown model: {model_name}'}), 400
        
        data = request.json or {}
        frame_count = data.get('frameCount', 4)
        
        if model_name == 'random_forest':
            predictors['random_forest'] = RandomForestPredictor(frame_count=frame_count)
        elif model_name == 'xgboost':
            predictors['xgboost'] = XGBoostPredictor(frame_count=frame_count)
        elif model_name == 'lstm':
            predictors['lstm'] = LSTMPredictor(frame_count=frame_count)
        
        return jsonify({
            'status': 'success',
            'message': f'{model_name} model reset',
            'frameCount': frame_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/configure', methods=['POST'])
def configure():
    """Configure predictor parameters"""
    global predictors
    try:
        data = request.json
        frame_count = data.get('frameCount', 4)
        
        # Reinitialize with new frame count
        predictors = {
            'random_forest': RandomForestPredictor(frame_count=frame_count),
            'xgboost': XGBoostPredictor(frame_count=frame_count),
            'lstm': LSTMPredictor(frame_count=frame_count)
        }
        
        return jsonify({
            'status': 'success',
            'configuration': {
                'frameCount': frame_count,
                'models': list(predictors.keys())
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/export', methods=['GET'])
def export_state():
    """Export all model states for persistence"""
    try:
        states = {}
        for name, predictor in predictors.items():
            if hasattr(predictor, 'export_state'):
                states[name] = predictor.export_state()
        
        return jsonify(states)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/import', methods=['POST'])
def import_state():
    """Import model states from persistence"""
    try:
        data = request.json
        
        for name, state in data.items():
            if name in predictors and hasattr(predictors[name], 'import_state'):
                predictors[name].import_state(state)
        
        return jsonify({
            'status': 'success',
            'imported': list(data.keys())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/compare', methods=['POST'])
def compare_models():
    """
    Run comparison across all models for given access sequence.
    Uses TRAINED models if available - they need to be trained first using /train-all
    """
    try:
        data = request.json
        sequence = data.get('sequence', [])
        frame_count = data.get('frameCount', 4)
        
        if not sequence:
            return jsonify({'error': 'No access sequence provided'}), 400
        
        # Create test predictors that COPY training state from global predictors
        test_predictors = {}
        
        for name in ['random_forest', 'xgboost', 'lstm']:
            global_predictor = predictors[name]
            
            # Create new instance with same frame count
            if name == 'random_forest':
                test_pred = RandomForestPredictor(frame_count=frame_count)
            elif name == 'xgboost':
                test_pred = XGBoostPredictor(frame_count=frame_count)
            else:
                test_pred = LSTMPredictor(frame_count=frame_count)
        
            # Copy training state from global predictor if it's trained
            if hasattr(global_predictor, 'is_fitted') and global_predictor.is_fitted:
                # Copy the model and preprocessing components
                test_pred.model = global_predictor.model
                test_pred.label_encoder = global_predictor.label_encoder
                test_pred.classes_ = global_predictor.classes_ if hasattr(global_predictor, 'classes_') else []
                test_pred.is_fitted = True
                test_pred.train_accuracy = global_predictor.train_accuracy if hasattr(global_predictor, 'train_accuracy') else 0
                test_pred.test_accuracy = global_predictor.test_accuracy if hasattr(global_predictor, 'test_accuracy') else 0
                
                # Copy model-specific preprocessing components
                if hasattr(global_predictor, 'scaler'):
                    test_pred.scaler = global_predictor.scaler
                if hasattr(global_predictor, 'vectorizer'):
                    test_pred.vectorizer = global_predictor.vectorizer
                # Copy target encoder (used by Random Forest and XGBoost)
                if hasattr(global_predictor, 'target_encoder'):
                    test_pred.target_encoder = global_predictor.target_encoder
            
            test_predictors[name] = test_pred
        
        results = {}
        
        for name, predictor in test_predictors.items():
            for access in sequence:
                if isinstance(access, dict):
                    process_id = access.get('processId', 'P1')
                    page_number = access.get('pageNumber', 0)
                else:
                    process_id = 'P1'
                    page_number = access
                
                predictor.access_page(process_id, page_number)
            
            # Get final stats
            if hasattr(predictor, 'get_state'):
                stats = predictor.get_state()
            elif hasattr(predictor, 'get_stats'):
                stats = predictor.get_stats()
            else:
                stats = {}
            
            # Format stats for frontend
            total = stats.get('page_faults', 0) + stats.get('page_hits', 0)
            hit_ratio = stats.get('hit_ratio', 0)
            if isinstance(hit_ratio, float):
                hit_ratio = f"{hit_ratio * 100:.1f}%"
            
            results[name] = {
                'stats': {
                    'page_faults': stats.get('page_faults', 0),
                    'page_hits': stats.get('page_hits', 0),
                    'hit_ratio': hit_ratio,
                    'accuracy': f"{stats.get('prediction_accuracy', 0):.1f}%",
                    'trained': predictor.is_fitted if hasattr(predictor, 'is_fitted') else False
                },
                'model_stats': predictor.get_model_stats() if hasattr(predictor, 'get_model_stats') else {}
            }
        
        # Clean up test predictors to free memory
        del test_predictors
        gc.collect()
        
        return jsonify({
            'sequence_length': len(sequence),
            'frame_count': frame_count,
            'results': results
        })
    except Exception as e:
        gc.collect()  # Clean up even on error
        return jsonify({'error': str(e)}), 500


@app.route('/ml-evaluation', methods=['POST'])
def ml_evaluation():
    """Formal ML evaluation metrics for all models"""
    try:
        data = request.json
        sequence = data.get('sequence', [])
        frame_count = data.get('frameCount', 4)
        
        if not sequence:
            return jsonify({'error': 'No access sequence provided'}), 400
        
        # Create fresh instances
        test_predictors = {
            'Random Forest': RandomForestPredictor(frame_count=frame_count),
            'XGBoost': XGBoostPredictor(frame_count=frame_count),
            'LSTM': LSTMPredictor(frame_count=frame_count)
        }
        
        evaluations = []
        
        for name, predictor in test_predictors.items():
            hits = 0
            faults = 0
            correct_predictions = 0
            total_predictions = 0
            last_prediction = None
            
            for access in sequence:
                if isinstance(access, dict):
                    process_id = access.get('processId', 'P1')
                    page_number = access.get('pageNumber', 0)
                else:
                    process_id = 'P1'
                    page_number = access
                
                page_key = f"{process_id}-{page_number}"
                
                # Check prediction accuracy
                if last_prediction is not None:
                    total_predictions += 1
                    if last_prediction == page_key:
                        correct_predictions += 1
                
                result = predictor.access_page(process_id, page_number)
                
                if result['hit']:
                    hits += 1
                else:
                    faults += 1
                
                last_prediction = result.get('prediction')
            
            total = hits + faults
            hit_ratio = hits / total if total > 0 else 0
            precision = correct_predictions / total_predictions if total_predictions > 0 else 0
            
            evaluations.append({
                'model': name,
                'accuracy': f"{precision * 100:.2f}%",
                'precision': f"{precision * 100:.2f}%",
                'recall': f"{hit_ratio * 100:.2f}%",
                'f1Score': f"{(2 * precision * hit_ratio / (precision + hit_ratio) * 100) if (precision + hit_ratio) > 0 else 0:.2f}%",
                'hitRatio': f"{hit_ratio * 100:.2f}%",
                'pageFaults': faults
            })
        
        return jsonify({
            'evaluations': evaluations,
            'sequenceLength': len(sequence),
            'frameCount': frame_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("[ML] Python ML Service Starting...")
    print("[ML] Available Models: Random Forest, XGBoost, LSTM")
    print("[ML] Running on http://localhost:8000")
    app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)
