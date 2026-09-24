import numpy as np
import cvxopt  # library for convex optimization

# hide cvxopt output
cvxopt.solvers.options['show_progress'] = False

class SVM:
  """
  Hard (C=None) and Soft (C>0) Margin Support Vector Machine classifier (binary)
  """
  def __init__(self, C=1):
      self.C = C
      self.alphas = None
      self.support_vectors = None
      self.support_vector_labels = None
      self.w = None
      self.t = None

  def fit(self, X, y):
    
      """
      X - numpy array or pandas DataFrame
      y - numpy array or pandas DataFrame with 1 and -1 encoding
      """
      nr_samples, nr_features = np.shape(X)

      # define the quadratic optimization problem 
      # (the dual problem from the lecture slides but in terms of minimization)
      # by constructing the appropriate matrices P, q, A, b...
      P = cvxopt.matrix(np.outer(y, y) * np.matmul(X, X.T), tc = 'd') # YOUR CODE HERE)
      q = cvxopt.matrix(-1 * np.ones(len(y)), tc = 'd')  # YOUR CODE HERE)
      A = cvxopt.matrix(y, (1, len(y)), tc = 'd')  # YOUR CODE HERE)
      b = cvxopt.matrix(0, tc = 'd') # YOUR CODE HERE)

      if not self.C:
        # the case when C=0 (Hard-margin SVM)
        G = cvxopt.matrix(-1 * np.identity(len(y)))# YOUR CODE HERE)
        h = cvxopt.matrix(np.zeros((len(y)))) # YOUR CODE HERE)
      else:
        # the case when C>0 (Soft-margin SVM)
        G_max = -1 * np.identity(len(y))  # YOUR CODE HERE
        G_min = np.identity(len(y))  # YOUR CODE HERE
        G = cvxopt.matrix(np.vstack((G_max, G_min)))
        h_max = cvxopt.matrix(np.zeros(len(y)))# YOUR CODE HERE)
        h_min = cvxopt.matrix(np.ones(len(y)) * self.C)# YOUR CODE HERE)
        h = cvxopt.matrix(np.vstack((h_max, h_min)))

      # solve the quadratic optimization problem using cvxopt
      minimization = cvxopt.solvers.qp(P, q, G, h, A, b)

      # lagrange multipliers (denoted by alphas in the lecture slides)
      alphas = np.ravel(minimization['x'])

      # first get indexes of non-zero lagr. multipiers
      idx = alphas > 1e-7

      # get the corresponding lagr. multipliers (non-zero alphas)
      self.alphas = alphas[idx]

      # get the support vectors
      self.support_vectors = X[idx]
      
      # get the corresponding labels
      self.support_vector_labels = y[idx]

      # calculate w using the alphas, support_vectors and 
      # the corresponding labels
      self.w = ((alphas * y).reshape((len(y)))  @ X)  # YOUR CODE HERE 
      # calculate t using w and the first support vector
      self.t = ((self.w @ self.support_vectors.T) - self.support_vector_labels)[0]


  def predict(self, X):
      return np.sign(self.w @ X.T - self.t)