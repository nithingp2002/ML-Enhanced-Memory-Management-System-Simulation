"""
XGBoost Predictor for Page Replacement
======================================
sklearn-compatible XGBClassifier with proper ML Pipeline

Pipeline:
1. Data Loading
2. Feature Engineering
3. Data Preprocessing (LabelEncoder, StandardScaler)
4. Train/Test Split
5. Model Building (XGBClassifier)
6. Training with Early Stopping
7. Evaluation
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from xgboost import XGBClassifier
import joblib


class XGBoostPredictor:
    """
    XGBoost Classifier for Page Access Prediction
    Uses XGBClassifier with full ML pipeline
    """
    
    def __init__(self, frame_count=4, context_window=3, test_size=0.2, random_state=42):
        # ============ HYPERPARAMETERS ============
        self.frame_count = frame_count
        self.context_window = context_window
        self.test_size = test_size
        self.random_state = random_state
        
        # ============ PREPROCESSING (sklearn) ============
        self.label_encoder = LabelEncoder()
        self.target_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        
        # ============ MODEL (XGBoost) ============
        self.model = XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=random_state,
            use_label_encoder=False,
            eval_metric='mlogloss'
        )
        
        # ============ DATA STORAGE ============
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.history = []
        self.classes_ = []
        
        # ============ MEMORY STATE ============
        self.frames = [None] * frame_count
        self.frame_metadata = [
            {'page': None, 'load_time': 0, 'last_access': 0, 'access_count': 0}
            for _ in range(frame_count)
        ]
        
        # ============ TRAINING STATE ============
        self.is_fitted = False
        
        # ============ EVALUATION METRICS ============
        self.train_accuracy = 0.0
        self.test_accuracy = 0.0
        self.cv_scores = []
        self.feature_importances = []
        self.page_faults = 0
        self.page_hits = 0
        self.correct_predictions = 0
        self.total_predictions = 0
        self.last_prediction = None
        self.current_time = 0
    
    # ================================================
    # STEP 1: DATA LOADING
    # ================================================
    def load_data(self, sequences):
        """
        Load and prepare data from page access sequences
        
        Args:
            sequences: List of page access sequences
        Returns:
            features: List of context windows
            targets: List of target pages
        """
        print("Step 1: Loading Data...")
        
        features = []
        targets = []
        
        for seq in sequences:
            pages = []
            for access in seq:
                if isinstance(access, dict):
                    page_key = f"{access.get('processId', 'P1')}-{access.get('pageNumber', 0)}"
                else:
                    page_key = str(access)
                pages.append(page_key)
            
            # Create feature vectors from context window
            for i in range(self.context_window, len(pages)):
                context = pages[i - self.context_window:i]
                target = pages[i]
                features.append(context)
                targets.append(target)
        
        print(f"   Created {len(features)} samples")
        return features, targets
    
    # ================================================
    # STEP 2: FEATURE ENGINEERING
    # ================================================
    def engineer_features(self, features, targets):
        """
        Engineer features for XGBoost
        
        Args:
            features: List of context windows
            targets: List of target pages
        Returns:
            X: Feature DataFrame
            y: Target array
        """
        print("Step 2: Feature Engineering...")
        
        # Fit label encoder on all unique pages
        all_pages = set()
        for context in features:
            all_pages.update(context)
        all_pages.update(targets)
        
        self.label_encoder.fit(list(all_pages))
        self.classes_ = list(self.label_encoder.classes_)
        print(f"   Unique pages: {len(self.classes_)}")
        
        # Fit target encoder
        self.target_encoder.fit(targets)
        
        # Create feature matrix
        X_data = []
        for context in features:
            encoded_context = self.label_encoder.transform(context)
            
            # Basic features: encoded page numbers
            feature_row = list(encoded_context)
            
            # Statistical features
            unique, counts = np.unique(encoded_context, return_counts=True)
            feature_row.append(len(unique))  # Unique pages in context
            feature_row.append(max(counts) if len(counts) > 0 else 0)  # Max frequency
            feature_row.append(np.mean(encoded_context))  # Mean page number
            feature_row.append(np.std(encoded_context) if len(encoded_context) > 1 else 0)  # Std dev
            
            # Recency features
            feature_row.append(encoded_context[-1])  # Most recent page
            feature_row.append(encoded_context[-1] - encoded_context[0])  # Page difference
            
            X_data.append(feature_row)
        
        # Create DataFrame
        columns = [f'page_{i}' for i in range(self.context_window)]
        columns += ['unique_count', 'max_freq', 'mean_page', 'std_page', 'most_recent', 'page_diff']
        
        X = pd.DataFrame(X_data, columns=columns)
        y = self.target_encoder.transform(targets)
        
        print(f"   Features: {X.shape[1]}")
        return X, y
    
    # ================================================
    # STEP 3: DATA PREPROCESSING
    # ================================================
    def preprocess(self, X, fit=True):
        """
        Preprocess features using StandardScaler
        
        Args:
            X: Feature DataFrame
            fit: Whether to fit the scaler
        Returns:
            X_scaled: Scaled features
        """
        print("Step 3: Preprocessing (StandardScaler)...")
        
        if fit:
            X_scaled = self.scaler.fit_transform(X)
        else:
            X_scaled = self.scaler.transform(X)
        
        print(f"   Scaled {X.shape[1]} features")
        return X_scaled
    
    # ================================================
    # STEP 4: TRAIN/TEST SPLIT
    # ================================================
    def split_data(self, X, y):
        """
        Split data into training and testing sets
        
        Args:
            X: Feature matrix
            y: Target array
        Returns:
            X_train, X_test, y_train, y_test
        """
        print(f"Step 4: Train/Test Split (test_size={self.test_size})...")
        
        # Check if we can stratify
        unique_classes = np.unique(y)
        can_stratify = len(unique_classes) > 1 and all(np.sum(y == c) >= 2 for c in unique_classes)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=self.test_size,
            random_state=self.random_state,
            stratify=y if can_stratify else None
        )
        
        self.X_train = X_train
        self.X_test = X_test
        self.y_train = y_train
        self.y_test = y_test
        
        print(f"   Training samples: {len(X_train)}")
        print(f"   Testing samples: {len(X_test)}")
        
        return X_train, X_test, y_train, y_test
    
    # ================================================
    # STEP 5: MODEL BUILDING
    # ================================================
    def build_model(self, n_estimators=100, max_depth=6, learning_rate=0.1):
        """
        Build XGBoost model with hyperparameters
        
        Args:
            n_estimators: Number of boosting rounds
            max_depth: Maximum tree depth
            learning_rate: Learning rate (eta)
        """
        print("Step 5: Building Model (XGBClassifier)...")
        
        self.model = XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=self.random_state,
            use_label_encoder=False,
            eval_metric='mlogloss'
        )
        
        print(f"   n_estimators: {n_estimators}")
        print(f"   max_depth: {max_depth}")
        print(f"   learning_rate: {learning_rate}")
    
    # ================================================
    # STEP 6: TRAINING
    # ================================================
    def fit(self, X_train, y_train):
        """
        Train the XGBoost model
        
        Args:
            X_train: Training features
            y_train: Training labels
        """
        print("\n" + "="*50)
        print("Step 6: TRAINING XGBOOST")
        print("="*50)
        
        # Train the model
        self.model.fit(X_train, y_train, verbose=False)
        self.is_fitted = True
        
        # Calculate training accuracy
        y_pred_train = self.model.predict(X_train)
        self.train_accuracy = accuracy_score(y_train, y_pred_train)
        
        # Cross-validation
        self.cv_scores = cross_val_score(self.model, X_train, y_train, cv=3)
        
        # Feature importance
        self.feature_importances = self.model.feature_importances_
        
        print(f"   Training Accuracy: {self.train_accuracy:.4f}")
        print(f"   CV Score (mean): {np.mean(self.cv_scores):.4f}")
        print(f"   CV Score (std): {np.std(self.cv_scores):.4f}")
        
        return self
    
    # ================================================
    # STEP 7: PREDICTION
    # ================================================
    def predict(self, X):
        """Predict next page"""
        return self.model.predict(X)
    
    def predict_proba(self, X):
        """Predict probabilities for all classes"""
        return self.model.predict_proba(X)
    
    # ================================================
    # STEP 8: EVALUATION
    # ================================================
    def evaluate(self, X_test, y_test):
        """
        Evaluate model on test data
        
        Args:
            X_test: Test features
            y_test: Test labels
        """
        print("\n" + "="*50)
        print("Step 7: MODEL EVALUATION")
        print("="*50)
        
        # Predictions
        y_pred = self.predict(X_test)
        
        # Accuracy
        self.test_accuracy = accuracy_score(y_test, y_pred)
        print(f"\n   Test Accuracy: {self.test_accuracy:.4f}")
        print(f"   Train Accuracy: {self.train_accuracy:.4f}")
        
        # Classification Report
        print("\n   Classification Report:")
        print(classification_report(y_test, y_pred, zero_division=0))
        
        # Feature Importance
        print("\n   Top 5 Feature Importances:")
        feature_names = [f'page_{i}' for i in range(self.context_window)] + ['unique_count', 'max_freq', 'mean_page', 'std_page', 'most_recent', 'page_diff']
        importances = sorted(zip(feature_names, self.feature_importances), key=lambda x: x[1], reverse=True)
        for name, imp in importances[:5]:
            print(f"      {name}: {imp:.4f}")
        
        return {
            'test_accuracy': float(self.test_accuracy),
            'train_accuracy': float(self.train_accuracy),
            'cv_score_mean': float(np.mean(self.cv_scores)),
            'cv_score_std': float(np.std(self.cv_scores))
        }
    
    # ================================================
    # FULL PIPELINE
    # ================================================
    def run_pipeline(self, sequences):
        """
        Run complete ML pipeline
        
        Args:
            sequences: List of page access sequences
        """
        print("\n" + "="*50)
        print("XGBOOST ML PIPELINE")
        print("="*50)
        
        # Step 1: Load Data
        features, targets = self.load_data(sequences)
        
        # Step 2: Feature Engineering
        X, y = self.engineer_features(features, targets)
        
        # Step 3: Preprocessing
        X_scaled = self.preprocess(X, fit=True)
        
        # Step 4: Train/Test Split
        X_train, X_test, y_train, y_test = self.split_data(X_scaled, y)
        
        # Step 5: Build Model
        self.build_model()
        
        # Step 6: Training
        self.fit(X_train, y_train)
        
        # Step 7: Evaluation
        metrics = self.evaluate(X_test, y_test)
        
        return metrics
    
    # ================================================
    # ONLINE PREDICTION (for real-time use)
    # ================================================
    def access_page(self, process_id, page_number):
        """Process single page access for real-time use"""
        page_key = str(page_number)
        self.current_time += 1
        
        # Check prediction accuracy
        if self.last_prediction is not None:
            self.total_predictions += 1
            if self.last_prediction == page_key:
                self.correct_predictions += 1
        
        # Add to history
        self.history.append(page_key)
        
        # Make prediction if we have enough history and model is trained
        if len(self.history) >= self.context_window and self.is_fitted:
            context = self.history[-self.context_window:]
            try:
                if all(p in self.classes_ for p in context):
                    encoded = self.label_encoder.transform(context)
                    unique, counts = np.unique(encoded, return_counts=True)
                    feature_row = list(encoded) + [
                        len(unique), max(counts) if len(counts) > 0 else 0,
                        np.mean(encoded), np.std(encoded) if len(encoded) > 1 else 0,
                        encoded[-1], encoded[-1] - encoded[0]
                    ]
                    X = self.scaler.transform([feature_row])
                    pred_idx = self.model.predict(X)[0]
                    self.last_prediction = self.target_encoder.inverse_transform([pred_idx])[0]
                else:
                    self.last_prediction = None
            except:
                self.last_prediction = None
        else:
            self.last_prediction = None
        
        # Handle page hit/fault
        if page_key in self.frames:
            self.page_hits += 1
            frame_idx = self.frames.index(page_key)
            self.frame_metadata[frame_idx]['last_access'] = self.current_time
            self.frame_metadata[frame_idx]['access_count'] += 1
            return {'hit': True, 'page': page_key, 'frame': frame_idx, 'prediction': self.last_prediction}
        
        self.page_faults += 1
        free_frame = next((i for i, f in enumerate(self.frames) if f is None), None)
        
        if free_frame is not None:
            target_frame = free_frame
            replaced = None
        else:
            target_frame = self._select_victim()
            replaced = self.frames[target_frame]
        
        self.frames[target_frame] = page_key
        self.frame_metadata[target_frame] = {
            'page': page_key, 'load_time': self.current_time,
            'last_access': self.current_time, 'access_count': 1
        }
        
        return {'hit': False, 'page': page_key, 'frame': target_frame, 'replaced': replaced, 'prediction': self.last_prediction}
    
    def _select_victim(self):
        """Select victim frame using ML prediction"""
        if len(self.history) >= self.context_window and self.is_fitted:
            context = self.history[-self.context_window:]
            try:
                if all(p in self.classes_ for p in context):
                    encoded = self.label_encoder.transform(context)
                    unique, counts = np.unique(encoded, return_counts=True)
                    feature_row = list(encoded) + [
                        len(unique), max(counts) if len(counts) > 0 else 0,
                        np.mean(encoded), np.std(encoded) if len(encoded) > 1 else 0,
                        encoded[-1], encoded[-1] - encoded[0]
                    ]
                    X = self.scaler.transform([feature_row])
                    probs = self.model.predict_proba(X)[0]
                    
                    min_score = float('inf')
                    victim = 0
                    for i in range(self.frame_count):
                        page = self.frames[i]
                        if page and page in self.classes_:
                            try:
                                page_encoded = self.target_encoder.transform([page])[0]
                                ml_prob = probs[page_encoded] if page_encoded < len(probs) else 0
                            except:
                                ml_prob = 0
                            recency = (self.current_time - self.frame_metadata[i]['last_access']) / max(1, self.current_time)
                            score = ml_prob - recency * 0.3
                            if score < min_score:
                                min_score = score
                                victim = i
                    return victim
            except:
                pass
        
        # Fallback to LRU
        return min(range(self.frame_count), key=lambda i: self.frame_metadata[i]['last_access'] if self.frames[i] else float('inf'))
    
    # ================================================
    # MODEL PERSISTENCE
    # ================================================
    def save_model(self, filepath):
        """Save model to file"""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'label_encoder': self.label_encoder,
            'target_encoder': self.target_encoder,
            'classes_': self.classes_,
            'train_accuracy': self.train_accuracy,
            'test_accuracy': self.test_accuracy,
            'feature_importances': self.feature_importances.tolist() if hasattr(self.feature_importances, 'tolist') else self.feature_importances
        }, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath):
        """Load model from file"""
        data = joblib.load(filepath)
        self.model = data['model']
        self.scaler = data['scaler']
        self.label_encoder = data['label_encoder']
        self.target_encoder = data['target_encoder']
        self.classes_ = data['classes_']
        self.train_accuracy = data['train_accuracy']
        self.test_accuracy = data['test_accuracy']
        self.feature_importances = data['feature_importances']
        self.is_fitted = True
        print(f"Model loaded from {filepath}")
    
    # ================================================
    # METRICS
    # ================================================
    def get_state(self):
        """Get current state metrics"""
        total = self.page_faults + self.page_hits
        return {
            'page_faults': self.page_faults,
            'page_hits': self.page_hits,
            'hit_ratio': self.page_hits / total if total > 0 else 0,
            'prediction_accuracy': (self.correct_predictions / self.total_predictions * 100) if self.total_predictions > 0 else 0
        }
    
    def get_model_stats(self):
        """Get ML model statistics"""
        return {
            'model_type': 'XGBoost (XGBClassifier)',
            'is_fitted': self.is_fitted,
            'n_classes': int(len(self.classes_)),
            'n_estimators': int(self.model.n_estimators) if self.is_fitted else 100,
            'max_depth': int(self.model.max_depth) if self.model.max_depth else None,
            'learning_rate': float(self.model.learning_rate),
            'context_window': int(self.context_window),
            'train_accuracy': float(self.train_accuracy) if self.train_accuracy else 0.0,
            'test_accuracy': float(self.test_accuracy) if self.test_accuracy else 0.0,
            'cv_score_mean': float(np.mean(self.cv_scores)) if self.cv_scores is not None and len(self.cv_scores) > 0 else 0.0,
            'prediction_accuracy': float(self.correct_predictions / self.total_predictions * 100) if self.total_predictions > 0 else 0.0
        }
    
    def reset(self):
        """Reset the model"""
        self.__init__(self.frame_count, self.context_window, self.test_size, self.random_state)
