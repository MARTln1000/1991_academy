import numpy as np
import pandas as pd

# if you want to use your own Decision Tree implementation for Random Forest
from decision_tree import DTClassifier  

# something useful for tracking algorithm's iterations
import progressbar

widgets = ['Model Training: ', progressbar.Percentage(), ' ',
            progressbar.Bar(marker="-", left="[", right="]"),
            ' ', progressbar.ETA()]

def get_bootstrap_samples(X, y, nr_bootstraps, nr_samples=None):
  # this function is for getting bootstrap samples with replacement 
  # from the initial dataset (X, y)
  # nr_bootstraps is the number of bootstraps needed
  # nr_samples is the number of data points to sample each time
  # it should be the size of X, if nr_samples is not provided
  # Hint: you may need np.random.choice function somewhere in this function

  # YOUR CODE HERE
  bootstrap_samples = []
  for _ in range(nr_bootstraps):

      a = np.random.choice(np.arange(X.shape[0]),size = X.shape[0])
      d = X[a]
      bootstrap_samples.append([d[:,: None], y[a]])
        
  return bootstrap_samples

class Bagging:
  def __init__(self, base_estimator, nr_estimators=10):
    # number of models in the ensemble
    self.nr_estimators = nr_estimators
    self.progressbar = progressbar.ProgressBar(widgets=widgets)
    # this can be any object that has 'fit', 'predict' methods
    self.base_estimator = base_estimator
  
  def fit(self, X, y):
    # this method will fit a separate model (self.base_estimator)
    # on each bootstrap sample and each model should be stored
    # in order to use it in 'predict' method
    X = np.array(X)
    y = np.array(y)
    bootstrap_samples = get_bootstrap_samples(X, y,
                                              nr_bootstraps=self.nr_estimators)
    clf = self.base_estimator
    self.models = []
    for i in self.progressbar(range(self.nr_estimators)):
      model = clf.fit(bootstrap_samples[i][0], bootstrap_samples[i][1])
      self.models.append(model)
      # YOUR CODE HERE
  def predict(self, X):
    # this method will predict the labels for a given test dataset
    # get the majority 'vote' for each test instance from the ensemble
    # Hint: you may want to use 'mode' method from scipy.stats
    # YOUR CODE HERE
    from scipy.stats import mode
    y_preds = []
    pred = []
    for i in self.models:
      pred.append(i.predict(X))

    for j in range(len(pred[0])):
      a = []
      for i in pred:
        a.append(i[j])
      y_preds.append(int(mode(a)[0]))



    return np.array(y_preds)

class RandomForest:
  def __init__(self, nr_estimators=10, max_features=None, min_samples_split=2,
                min_gain=0, max_depth=float("inf")):
    # number of trees in the forest
    self.nr_estimators = nr_estimators

    # this is the number of features to use for each tree
    # if not specified this should be set to sqrt(initial number of features)
    self.max_features = max_features

    # the rest is for decision tree
    self.min_samples_split = min_samples_split
    self.min_gain = min_gain
    self.max_depth = max_depth
    self.progressbar = progressbar.ProgressBar(widgets=widgets)
    self.idx = []

  def fit(self, X, y):
    # this method will fit a separate tree
    # on each bootstrap sample and subset of features
    # each tree should be stored
    # in order to use it in 'predict' method

    X = np.array(X)
    y = np.array(y)
    bootstrap_samples = get_bootstrap_samples(X, y,
                                              self.nr_estimators)

    self.trees = []
    for i in self.progressbar(range(self.nr_estimators)):
      # you can modify the code to use sklearn's decision tree
      # if you don't want to use your implementation
      tree = DTClassifier(
                min_samples_split=self.min_samples_split,
                min_impurity=self.min_gain,
                max_depth=self.max_depth)
      X_boot, y_boot = bootstrap_samples[i]

      # YOUR CODE HERE
      if self.max_features == None:
        idx = np.random.choice(np.arange(X.shape[1]), round(np.sqrt(X.shape[1])))
      else:
        idx = np.random.choice(np.arange(X.shape[1]), self.max_features)

      # we need to keep the indices of the features used for this tree
      tree.feature_indices = idx
      tree.fit(X_boot[:, idx], y_boot)
      self.trees.append(tree)
      self.idx.append(idx)

  def predict(self, X):
    # this method will predict the labels for a given test dataset
    # get the majority 'vote' for each test instance from the forest
    # Hint: you may want to use 'mode' method from scipy.stats
    # besides the individual trees, you will also need the feature indices
    # it was trained on
    # YOUR CODE HERE
    from scipy.stats import mode
    y_preds = []
    pred = []
    for i in range(len(self.trees)):
      pred.append(self.trees[i].predict(X[:, self.idx[i]]))
    for j in range(len(pred[0])):
      a = []
      for i in pred:
        a.append(i[j])
      y_preds.append(int(mode(a)[0]))
    return y_preds

class WeightedVoting:
  def __init__(self, estimators):
    # list of classifier objects
    self.estimators = estimators
    self.nr_estimators = len(estimators)
    self.weights = []
    self.progressbar = progressbar.ProgressBar(widgets=widgets)

  def get_weights(self, X, y):
    # This method is for deriving the weights of each individual classifier
    # using cross-validation as described in the lecture slides
    # the output should be an array of weights
    # YOUR CODE HERE
    from sklearn.model_selection import GridSearchCV
    for i in self.estimators:
      params = {}
      model = i
      clf = GridSearchCV(model, params, scoring='accuracy', cv=4)
      clf.fit(X, y)
      self.weights.append(clf.best_score_)


  def fit(self, X, y):
    # Train the individual models on the whole training dataset
    # and update self.estimators accordingly in order to use them for prediction
    self.get_weights(X, y)
    # YOUR CODE HERE
    for i in self.progressbar(range(len(self.estimators))):
      self.estimators[i].fit(X, y)


  def predict(self, X):
    # Use the fitted individual models and their weights to perform prediction
    # This link may be useful
    # https://scikit-learn.org/stable/modules/ensemble.html#weighted-average-probabilities-soft-voting
    # YOUR CODE HERE
    pred = np.ones((self.nr_estimators ,X.shape[0], len(self.weights)))
    for i in range(len(self.estimators)):
      pred[i] = self.estimators[i].predict_proba(X) * self.weights[i]

    return  np.argmax(np.mean(pred, axis = 0), axis = 1)



#
class Stacking:
  def __init__(self, estimators, final_estimator, meta_features='class', cv=False, k=None):
    # list of classifier objects
    self.estimators = estimators
    # classifier for the meta-model
    self.final_estimator = final_estimator
    self.nr_estimators = len(estimators)
    self.progressbar = progressbar.ProgressBar(widgets=widgets)
    # meta-features (input) of the meta-model, this should take to values either
    # 'class' if we take the predicted labels or
    # 'prob' if we take the class probabilities from the individual models.

    # In case of 'prob' you need to use 'predict_proba' method on sklearn classifiers
    # and need to discard one of the probability values. For example, if the task is a 2 class classification problem,
    # then each individual model's predict_proba method will return a vector of 2 values for each class's probability
    # and we can discard one of those values because it is the complement of the other class. ([p, q], where q = 1-p)
    # In case we have a m-class classification problem and T individual models, then the input for the meta-model will be
    # T * (m-1) dimensional vector, since each model will give m-1 probability values.

    # In case of 'class', the input for the meta-model will be a T dimensional vector.
    self.meta_features = meta_features
    # boolean specifying whether to use cross validation for deriving the meta-features or not, as described in the lecture slides
    self.cv = cv
    # number of folds of cross validation
    self.k = k



  def fit(self, X, y):
    # Derive the meta-features and train the meta-model on it
    # YOUR CODE HERE
    self.n_class = len(pd.Series(y).unique())

    if self.cv == False:
      matrix = np.ones((X.shape[0], int((self.meta_features == 'class') * self.nr_estimators + (self.meta_features == 'prob') * (self.nr_estimators) * (self.n_class - 1) )))
      for i in self.progressbar(range(len(self.estimators))):
        self.estimators[i].fit(X, y)
        if self.meta_features == 'class':
          matrix[:, i] = self.estimators[i].predict(X)
        elif self.meta_features == 'prob':
          matrix[:, i : i + self.n_class - 1 ] = self.estimators[i].predict_proba(X)[:, -1].reshape(X.shape[0], 1)

    else:
      from sklearn.model_selection import GridSearchCV
      matrix = np.ones((X.shape[0], int((self.meta_features == 'class') * self.nr_estimators + (self.meta_features == 'prob') * (self.nr_estimators ) * (self.n_class - 1) )))
      for i in self.progressbar(range(len(self.estimators))):
        params = {}
        model = self.estimators[i]
        clf = GridSearchCV(model, params, scoring='accuracy', cv=self.k)
        clf.fit(X, y)
        if self.meta_features == 'class':
          matrix[:, i] = clf.predict(X)
        elif self.meta_features == 'prob':
          matrix[:, i : i + self.n_class - 1] = (clf.predict_proba(X)[:, -1]).reshape(X.shape[0], 1)

    self.final_estimator.fit(matrix, y)






  def predict(self, X):
    # Get the predictions of the individual models and provide them as inputs to the meta-model
    # YOUR CODE HERE.
    matrix = np.ones((X.shape[0], int((self.meta_features == 'class') * self.nr_estimators + (self.meta_features == 'prob') * (self.nr_estimators ) * (self.n_class - 1) )))
    for i in range(len(self.estimators)):
      if self.meta_features == 'class':
        matrix[:, i] = self.estimators[i].predict(X)
      elif self.meta_features == 'prob':
        matrix[:, i : i + self.n_class - 1 ] = self.estimators[i].predict_proba(X)[:, -1].reshape(X.shape[0], 1)

    pred = self.final_estimator.predict(matrix)
    return  pred

