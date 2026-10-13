# Gold Evaluation Questions (15)

**Dataset:** `data/sample_knowledge_document.md`\
**Purpose:** Grounded RAG evaluation. Expected answers are concise and
should be supported by the named section. The final evaluation script
must store actual retrieved chunks, answers, citation validity and
latency for both chunk sizes.

  ----------------------------------------------------------------------------
  ID                Question          Expected answer        Gold section
  ----------------- ----------------- ---------------------- -----------------
  Q01               How many days     An eligible item may   Returns and
                    after delivery    be returned within 30  Refunds
                    can a customer    days of delivery.      
                    return an                                
                    eligible item?                           

  Q02               Which items are   Final-sale items,      Returns and
                    not eligible for  personalized items,    Refunds
                    return?           and opened             
                                      digital-download codes 
                                      are not eligible,      
                                      except where           
                                      applicable law         
                                      requires otherwise.    

  Q03               How long does a   The refund is          Returns and
                    refund take after initiated within 5     Refunds
                    the returned item business days after    
                    is inspected?     inspection; the bank   
                                      may take additional    
                                      time to post it.       

  Q04               What should a     Report the damage      Damaged or
                    customer do if an within 48 hours of     Incorrect Items
                    item arrives      delivery and include   
                    damaged?          the order number and   
                                      clear photos of the    
                                      packaging and item.    

  Q05               When is standard  Usually within 3--5    Shipping and
                    domestic shipping business days after    Delivery
                    usually           dispatch.              
                    delivered?                               

  Q06               Does a tracking   No. Tracking may take  Shipping and
                    number mean the   up to 24 hours after   Delivery
                    parcel has        dispatch to show its   
                    already moved?    first carrier scan.    

  Q07               What happens if   The customer should    Shipping and
                    the delivery      contact support        Delivery
                    address is wrong  immediately; an        
                    after dispatch?   address change is not  
                                      guaranteed after       
                                      dispatch.              

  Q08               How can a         Email                  Contact and
                    customer contact  support@example.test   Support
                    support?          and include the order  
                                      number when the        
                                      request concerns an    
                                      order.                 

  Q09               What information  The order number, a    Billing and
                    should a customer description of the     Payments
                    provide when      discrepancy, and the   
                    reporting a       transaction date;      
                    billing issue?    never send a full      
                                      payment-card number.   

  Q10               Which payment     Credit/debit cards and Billing and
                    methods are       the listed local       Payments
                    supported in this wallet option are      
                    sample policy?    supported; payment     
                                      options shown at       
                                      checkout are           
                                      authoritative.         

  Q11               Can a customer    No. Support will never Account and
                    share a one-time  ask for a password,    Security
                    password with     one-time password, or  
                    support?          full card number.      

  Q12               What should a     Change the password    Account and
                    customer do if    from the official      Security
                    they suspect      account page and       
                    unauthorized      contact support        
                    account access?   promptly.              

  Q13               What is the       Eligible hardware      Warranty
                    warranty period   accessories have a     
                    for eligible      12-month limited       
                    hardware          warranty from          
                    accessories?      delivery, subject to   
                                      the stated exclusions. 

  Q14               Does the warranty No. Accidental liquid  Warranty
                    cover accidental  damage and             
                    liquid damage?    unauthorized           
                                      modifications are      
                                      excluded.              

  Q15               How long should a Contact support if     Missing Parcels
                    customer wait     tracking has not       
                    before contacting updated for 5 business 
                    support about a   days or the estimated  
                    missing parcel?   delivery date has      
                                      passed by 2 business   
                                      days.                  
  ----------------------------------------------------------------------------

## Scoring notes

-   Each gold section should be located in at least one retrieved chunk
    at the configured top-k for a retrieval success.
-   The actual chunk index is configuration-specific; record it per run.
-   Answers must not add conditions not present in the sample document.
-   Citation IDs and document names must be resolved from stored
    metadata.
-   Add a separate out-of-scope negative query set (e.g. "What is the
    capital of Japan?") to verify abstention. Do not mix it into the 15
    answerable gold questions unless the metrics explicitly distinguish
    it.
