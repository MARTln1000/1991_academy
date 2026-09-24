class MyNaiveBayes:
  def __init__(self, smoothing=False):
      # initialize Laplace smoothing parameter
      self.smoothing = smoothing
    
  def fit(self, X_train, y_train):
      # use this method to learn the model
      # if you feel it is easier to calculate priors 
      # and likelihoods at the same time
      # then feel free to change this method
      self.X_train = X_train
      self.y_train = y_train
      self.priors = self.calculate_priors()
      self.likelihoods = self.calculate_likelihoods()      
      
  def predict(self, X_test):
    
    
    
        
      # recall: posterior is P(label_i|feature_j)
      # hint: Posterior probability is a matrix of size 
      #       m*n (m samples and n labels)
      #       our prediction for each instance in data is the class that 
      #       has the highest posterior probability. 
      #       You do not need to normalize your posterior, 
      #       meaning that for classification, prior and likelihood are enough
      #       and there is no need to divide by evidence. Think why!
      # return: a list of class labels (predicted)
      ##### YOUR CODE STARTS HERE #####
    import numpy as np    
    X_train = self.X_train
    y_train = self.y_train
    likelihoods = self.calculate_likelihoods()
    prob = self.calculate_priors()
    
    labels = list (y_train.values.unique())
    d = []
    for i in range(len(X_test)):
        probab = []
        for c in range(len(prob)):# prob = p(label = l_i)
            g = prob[c]
            for j in range(X_test.shape[1]):  
                a = X_test.iloc[i][j]
                k_col = list (X_train.columns)# next 3 rows are for making the test and train 
                k_fet = list (X_train[k_col[j]].unique())# indexes same for calculation
                ind = k_fet.index(a)
                g *= likelihoods[y_train.unique()[c]][j][ind]

            probab.append(g)
        d.append(labels[np.argmax(probab)])
    

        
        
         

    prediction = d
      ##### YOUR CODE ENDS HERE #####       
    return prediction

  def calculate_priors(self):
    
    
        
      # recall: prior is P(label=l_i)
      # hint: store priors in a pandas Series or a list
      ##### YOUR CODE STARTS HERE ##### 
    y_train = self.y_train
    l = []
    for i in y_train:
            l.append(i)

    prob = []
    k = list (y_train.values.unique())
    for i in k:
        prob.append(l.count(i) / len(l))
    priors = prob
    return priors
      

      ##### YOUR CODE ENDS HERE #####         
    return priors
  
  def calculate_likelihoods(self):
    
        
        
      # recall: likelihood is P(feature=f_j|label=l_i)
      # hint: store likelihoods in a data structure like dictionary:
      #        feature_j = [likelihood_k]
      #        likelihoods = {label_i: [feature_j]}
      #       Where j implies iteration over features, and 
      #             k implies iteration over different values of feature j. 
      #       Also, i implies iteration over different values of label. 
      #       Likelihoods, is then a dictionary that maps different label 
      #       values to its corresponding likelihoods with respect to feature
      #       values (list of lists).
      #
      #       NB: The above pseudocode is for the purpose of understanding
      #           the logic, but it could also be implemented as it is.
      #           You are free to use any other data structure 
      #           or way that is convenient to you!
      #
      #       More Coding Hints: You are encouraged to use Pandas as much as
      #       possible for all these parts as it comes with flexible and
      #       convenient indexing features which makes the task easier.
      ##### YOUR CODE STARTS HERE ##### 
    X_train = self.X_train
    y_train = self.y_train
    k = list (X_train.columns)
    likelihood_l = []
    likelihoods = {}
    for q in y_train.values.unique():
        b = []
        for i in k:
            b = []
            unique_val = X_train[i].unique()
            for j in unique_val:
                if self.smoothing == True:
                    b.append((len(X_train[(X_train[i] == j) & (y_train == q) ]) + 1) / (len(y_train[y_train == q]) + len(unique_val)))
                else:
                    b.append(len(X_train[(X_train[i] == j) & (y_train == q) ]) / len(y_train[y_train == q]))
            likelihood_l.append(b)
        likelihoods[q] = likelihood_l
        likelihood_l = []

        
        


       

      ##### YOUR CODE ENDS HERE ##### 
    return likelihoods