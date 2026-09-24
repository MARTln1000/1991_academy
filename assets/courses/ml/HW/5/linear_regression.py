import numpy as np
import progressbar
import tensorflow as tf

widgets = ['Model Training: ', progressbar.Percentage(), ' ',
            progressbar.Bar(marker="-", left="[", right="]"),
            ' ', progressbar.ETA()]

class MyLinearRegression:

  def __init__(self, regularization=None, lam=0, learning_rate=1e-3, tol=0.05):
    """
    This class implements linear regression models
    Params:
    --------
    regularization - None for no regularization
                    'l2' for ridge regression
                    'l1' for lasso regression

    lam - lambda parameter for regularization in case of 
        Lasso and Ridge

    learning_rate - learning rate for gradient descent algorithm, 
                    used in case of Lasso

    tol - tolerance level for weight change in gradient descent
    """
    
    self.regularization = regularization 
    self.lam = lam 
    self.learning_rate = learning_rate 
    self.tol = tol
    self.weights = None
  
  def fit(self, X, y):
    
    X = np.array(X)
    # first insert a column with all 1s in the beginning
    # hint: you can use the function np.insert
    # YOUR CODE HERE
    X = np.insert(X, obj=0, values=np.ones((X.shape[0],)), axis=1)
    y = np.array(y).reshape(len(y), 1)

    if self.regularization is None:
      # the case when we don't apply regularization
      self.weights = np.linalg.inv(X.T @ X) @ X.T @ y # YOUR CODE HERE
    elif self.regularization == 'l2':
      # the case of Ridge regression
      self.weights = np.linalg.inv(X.T @ X + self.lam * np.identity(X.shape[0])) @ X.T @ y# YOUR CODE HERE
    elif self.regularization == 'l1':
      pass
      # in case of Lasso regression we use gradient descent
      # to find the optimal combination of weights that minimize the 
      # objective function in this case (slide 37)
      
      # initialize random weights, for example normally distributed
      self.weights = np.random.normal(size = X.shape[1])# YOUR CODE HERE

      converged = False
      # we can store the loss values to see how fast the algorithm converges
      self.loss = []
      # just a counter of algorithm steps
      i = 0
      w = tf.Variable(self.weights.reshape(len(self.weights), 1))
      while (not converged):
        w_old = w.numpy()
        i += 1
        with tf.GradientTape() as tape:
        # calculate the predictions in case of the weights in this stage
          y_pred = tf.matmul(X , w) # YOUR CODE HERE)
        # calculate the mean squared error (loss) for the predictions
        # obtained above

          self.loss.append(tf.reduce_sum((y - y_pred)**2)/X.shape[0] + self.lam * tf.reduce_sum(np.abs(w))/ X.shape[1])
          model_loss = tf.reduce_sum((y - y_pred)**2)/X.shape[0] + self.lam * tf.reduce_sum(np.abs(w))/ X.shape[1]

        # calculate the gradient of the objective function with respect to w
        # for the second component \sum|w_i| use np.sign(w_i) as it's derivative
        grad = tape.gradient(model_loss, w)# YOUR CODE HERE
        w.assign_sub(grad * self.learning_rate)
        w_new = w.numpy()
        # check whether the weights have changed a lot after this iteration
        # compute the norm of difference between old and new weights 
        # and compare with the pre-defined tolerance level, if the norm
        # is smaller than the tolerance level then we consider convergence
        # of the algorithm
        if np.linalg.norm(w_new - w_old) < self.tol:
          converged = True# YOUR CODE HERE
          print(f'Converged in {i} steps')

      self.weights = w.numpy()

  def predict(self, X):
    X = np.array(X)
    # don't forget to add the feature of 1s in the beginning
    X = np.insert(X, obj=0, values=np.ones((X.shape[0],)), axis=1) # YOUR CODE HERE
    # predict using the obtained weights
    return X @ self.weights # YOUR CODE HERE